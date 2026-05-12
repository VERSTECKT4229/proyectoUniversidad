<?php
header('Content-Type: application/json');
ini_set('display_errors', 0);
require_once '../session.php';
require_once '../config.php';
require_once 'mail_helper.php';
require_auth_api();

$me = $_SESSION['user'];
if ($me['rol'] !== 'administrativo') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Acceso denegado']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

// ─── GET: listar todas las reservas ──────────────────────────────────────────
if ($method === 'GET') {
    $estado  = $_GET['estado']  ?? '';
    $espacio = $_GET['espacio'] ?? '';

    $where  = ['1=1'];
    $params = [];

    $estados_validos = ['Pendiente', 'Aprobada', 'Rechazada', 'Cancelada'];
    if ($estado && in_array($estado, $estados_validos)) {
        $where[]  = 'r.estado = ?';
        $params[] = $estado;
    }

    $espacios_validos = ['B1', 'B2', 'B3'];
    if ($espacio && in_array($espacio, $espacios_validos)) {
        $where[]  = 'r.espacio = ?';
        $params[] = $espacio;
    }

    $sql = "SELECT r.id, r.fecha, r.hora_inicio, r.hora_fin, r.espacio,
                   r.requisitos, r.estado, r.created_at,
                   u.id AS usuario_id, u.nombre AS usuario, u.email
            FROM reservas r
            JOIN usuarios u ON u.id = r.usuario_id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY r.fecha DESC, r.hora_inicio ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode(['success' => true, 'reservas' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

// ─── PUT: editar reserva ──────────────────────────────────────────────────────
} elseif ($method === 'PUT') {
    $id          = intval($body['id']          ?? 0);
    $fecha       = trim($body['fecha']         ?? '');
    $hora_inicio = trim($body['hora_inicio']   ?? '');
    $hora_fin    = trim($body['hora_fin']      ?? '');
    $espacio     = trim($body['espacio']       ?? '');
    $estado      = trim($body['estado']        ?? '');
    $requisitos  = trim($body['requisitos']    ?? '');

    $estados_validos = ['Pendiente', 'Aprobada', 'Rechazada', 'Cancelada'];
    $espacios_validos = ['B1', 'B2', 'B3'];

    if (!$id || !$fecha || !$hora_inicio || !$hora_fin
        || !in_array($espacio, $espacios_validos)
        || !in_array($estado, $estados_validos)) {
        echo json_encode(['success' => false, 'message' => 'Datos inválidos o incompletos.']); exit;
    }

    if ($hora_inicio >= $hora_fin) {
        echo json_encode(['success' => false, 'message' => 'La hora de inicio debe ser menor a la hora de fin.']); exit;
    }

    // Verificar que la reserva existe
    $check = $pdo->prepare("SELECT id FROM reservas WHERE id = ?");
    $check->execute([$id]);
    if (!$check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Reserva no encontrada.']); exit;
    }

    // Verificar conflicto de horario con otras reservas (excluyendo la propia)
    $conflictoSql = "SELECT COUNT(*) FROM reservas
                     WHERE espacio = ? AND fecha = ? AND estado IN ('Pendiente','Aprobada')
                       AND (? < hora_fin AND ? > hora_inicio)
                       AND id != ?";
    $stmtConf = $pdo->prepare($conflictoSql);
    $stmtConf->execute([$espacio, $fecha, $hora_inicio, $hora_fin, $id]);
    if ((int)$stmtConf->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'message' => 'Ya existe una reserva en ese espacio y horario.']); exit;
    }

    // Si el espacio es B3, también verificar que B1 y B2 estén libres
    if ($espacio === 'B3') {
        foreach (['B1', 'B2'] as $dep) {
            $stmtDep = $pdo->prepare("SELECT COUNT(*) FROM reservas
                WHERE espacio = ? AND fecha = ? AND estado IN ('Pendiente','Aprobada')
                  AND (? < hora_fin AND ? > hora_inicio) AND id != ?");
            $stmtDep->execute([$dep, $fecha, $hora_inicio, $hora_fin, $id]);
            if ((int)$stmtDep->fetchColumn() > 0) {
                echo json_encode(['success' => false, 'message' => "No se puede asignar B3: {$dep} ya está ocupado en ese horario."]); exit;
            }
        }
    } elseif (in_array($espacio, ['B1', 'B2'])) {
        $stmtB3 = $pdo->prepare("SELECT COUNT(*) FROM reservas
            WHERE espacio = 'B3' AND fecha = ? AND estado IN ('Pendiente','Aprobada')
              AND (? < hora_fin AND ? > hora_inicio) AND id != ?");
        $stmtB3->execute([$fecha, $hora_inicio, $hora_fin, $id]);
        if ((int)$stmtB3->fetchColumn() > 0) {
            echo json_encode(['success' => false, 'message' => "No se puede asignar {$espacio}: B3 ya está ocupado en ese horario."]); exit;
        }
    }

    $stmt = $pdo->prepare("
        UPDATE reservas
        SET fecha = ?, hora_inicio = ?, hora_fin = ?, espacio = ?, estado = ?, requisitos = ?
        WHERE id = ?
    ");
    $stmt->execute([$fecha, $hora_inicio, $hora_fin, $espacio, $estado, $requisitos ?: null, $id]);
    echo json_encode(['success' => true, 'message' => 'Reserva actualizada correctamente.']);

// ─── DELETE: eliminar reserva ─────────────────────────────────────────────────
} elseif ($method === 'DELETE') {
    $id = intval($body['id'] ?? 0);
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID inválido.']); exit; }

    $check = $pdo->prepare("SELECT id FROM reservas WHERE id = ?");
    $check->execute([$id]);
    if (!$check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Reserva no encontrada.']); exit;
    }

    $pdo->prepare("DELETE FROM reservas WHERE id = ?")->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Reserva eliminada.']);

// ─── POST: aprobar o rechazar ─────────────────────────────────────────────────
} elseif ($method === 'POST') {
    $id     = intval($body['id']     ?? 0);
    $accion = trim($body['accion']   ?? '');

    if (!$id || !in_array($accion, ['aprobar', 'rechazar'])) {
        echo json_encode(['success' => false, 'message' => 'Datos inválidos.']); exit;
    }

    $stmt = $pdo->prepare("
        SELECT r.id, r.fecha, r.hora_inicio, r.hora_fin, r.espacio,
               u.nombre, u.email
        FROM reservas r JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.id = ? AND r.estado = 'Pendiente'
    ");
    $stmt->execute([$id]);
    $reserva = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$reserva) {
        echo json_encode(['success' => false, 'message' => 'Reserva no encontrada o ya procesada.']); exit;
    }

    $nuevoEstado = $accion === 'aprobar' ? 'Aprobada' : 'Rechazada';
    $pdo->prepare("UPDATE reservas SET estado = ? WHERE id = ?")->execute([$nuevoEstado, $id]);

    $subject = $accion === 'aprobar'
        ? 'Reserva APROBADA - Auditorio ' . $reserva['espacio']
        : 'Reserva RECHAZADA - Auditorio ' . $reserva['espacio'];
    $body_mail = $accion === 'aprobar'
        ? build_approval_email($reserva)
        : build_rejection_email($reserva);
    send_system_email($reserva['email'], $subject, $body_mail);

    $msg = $accion === 'aprobar' ? 'Reserva aprobada.' : 'Reserva rechazada.';
    echo json_encode(['success' => true, 'message' => $msg]);

} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
}
