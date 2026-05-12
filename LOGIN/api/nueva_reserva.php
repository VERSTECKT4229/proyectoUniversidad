<?php
header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';
require_auth_api();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

$data       = json_decode(file_get_contents('php://input'), true) ?? [];
$fecha      = trim($data['fecha']       ?? '');
$horaInicio = trim($data['hora_inicio'] ?? '');
$horaFin    = trim($data['hora_fin']    ?? '');
$espacio    = strtoupper(trim($data['espacio'] ?? ''));
$requisitos = mb_substr(trim($data['requisitos_adicionales'] ?? ''), 0, 500);
$recursos   = is_array($data['recursos'] ?? null) ? $data['recursos'] : [];
$userId     = (int)($_SESSION['user']['id'] ?? 0);

$espaciosValidos = ['B1', 'B2', 'B3'];

if (!$fecha || !$horaInicio || !$horaFin || !in_array($espacio, $espaciosValidos, true)) {
    echo json_encode(['success' => false, 'message' => 'Datos incompletos o inválidos.']); exit;
}

// Validar formato HH:MM
if (!preg_match('/^\d{2}:\d{2}$/', $horaInicio) || !preg_match('/^\d{2}:\d{2}$/', $horaFin)) {
    echo json_encode(['success' => false, 'message' => 'Formato de hora inválido. Use HH:MM.']); exit;
}

$fechaSolo = preg_replace('/[^0-9\-]/', '', explode(' ', $fecha)[0]);
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaSolo)) {
    echo json_encode(['success' => false, 'message' => 'Formato de fecha inválido.']); exit;
}

$fechaObj = new DateTime($fechaSolo);
$hoy      = new DateTime('today');

if ($fechaObj < $hoy) {
    echo json_encode(['success' => false, 'message' => 'No puedes reservar en una fecha pasada.']); exit;
}

$tsReserva = strtotime("$fechaSolo $horaInicio");
if ($tsReserva < (time() + 86400)) {
    echo json_encode(['success' => false, 'message' => 'Las reservas deben hacerse con al menos 24 horas de antelación.']); exit;
}

$maxFecha = (new DateTime('today'))->modify('+3 months');
if ($fechaObj > $maxFecha) {
    echo json_encode(['success' => false, 'message' => 'Solo puedes reservar con hasta 3 meses de anticipación.']); exit;
}

$diaSemana = $fechaObj->format('N');
if ($diaSemana === '2' || $diaSemana === '4') {
    echo json_encode(['success' => false, 'message' => 'No se permiten reservas los martes ni jueves.']); exit;
}

if ($horaInicio >= $horaFin) {
    echo json_encode(['success' => false, 'message' => 'La hora de inicio debe ser menor a la hora de fin.']); exit;
}
if ($horaInicio < '07:00' || $horaFin > '20:00') {
    echo json_encode(['success' => false, 'message' => 'Las reservas deben estar entre las 07:00 y las 20:00.']); exit;
}

// ── Funciones de conflicto (reutilizadas dentro de la transacción) ───────────
function hasConflict(PDO $pdo, string $espacio, string $fecha, string $ini, string $fin, ?int $excludeId = null): bool {
    $sql = "SELECT COUNT(*) FROM reservas
            WHERE espacio = ? AND fecha = ? AND estado IN ('Pendiente','Aprobada')
              AND (? < hora_fin AND ? > hora_inicio)";
    $params = [$espacio, $fecha, $ini, $fin];
    if ($excludeId) { $sql .= ' AND id != ?'; $params[] = $excludeId; }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int)$stmt->fetchColumn() > 0;
}

function verificarDisponibilidad(PDO $pdo, string $espacio, string $fecha, string $ini, string $fin): array {
    if ($espacio === 'B3') {
        if (hasConflict($pdo, 'B1', $fecha, $ini, $fin))
            return ['disponible' => false, 'mensaje' => 'No se puede reservar B3: B1 ya está ocupado en ese horario.'];
        if (hasConflict($pdo, 'B2', $fecha, $ini, $fin))
            return ['disponible' => false, 'mensaje' => 'No se puede reservar B3: B2 ya está ocupado en ese horario.'];
        if (hasConflict($pdo, 'B3', $fecha, $ini, $fin))
            return ['disponible' => false, 'mensaje' => 'B3 ya está ocupado en ese horario.'];
    } else {
        if (hasConflict($pdo, $espacio, $fecha, $ini, $fin))
            return ['disponible' => false, 'mensaje' => "El espacio {$espacio} ya está ocupado en ese horario."];
        if (hasConflict($pdo, 'B3', $fecha, $ini, $fin))
            return ['disponible' => false, 'mensaje' => "No se puede reservar {$espacio}: B3 ya está ocupado en ese horario."];
    }
    return ['disponible' => true, 'mensaje' => 'Disponible'];
}

try {
    // ── Validar día bloqueado ────────────────────────────────────────────────
    $stmtBlq = $pdo->prepare("SELECT motivo FROM dias_bloqueados WHERE fecha = ? LIMIT 1");
    $stmtBlq->execute([$fechaSolo]);
    $diaBloqueado = $stmtBlq->fetch(PDO::FETCH_ASSOC);
    if ($diaBloqueado !== false) {
        $motivo = $diaBloqueado['motivo'] ? ' Motivo: ' . $diaBloqueado['motivo'] : '';
        echo json_encode(['success' => false, 'message' => 'Este día está bloqueado por la administración.' . $motivo]); exit;
    }

    // ── Validar que recursos existen en la DB ────────────────────────────────
    $recursosValidos = [];
    foreach ($recursos as $rec) {
        $recId  = intval($rec['id']       ?? 0);
        $cant   = max(1, intval($rec['cantidad'] ?? 1));
        if ($recId <= 0) continue;

        $chk = $pdo->prepare("SELECT id, cantidad FROM recursos WHERE id = ?");
        $chk->execute([$recId]);
        $recurso = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$recurso) {
            echo json_encode(['success' => false, 'message' => "Recurso con ID {$recId} no existe."]); exit;
        }
        if ($cant > (int)$recurso['cantidad']) {
            echo json_encode(['success' => false, 'message' => "No hay suficientes unidades del recurso (máx. {$recurso['cantidad']})."]); exit;
        }
        $recursosValidos[] = ['id' => $recId, 'cantidad' => $cant];
    }

    // ── TRANSACCIÓN con bloqueo para evitar race condition ───────────────────
    $pdo->beginTransaction();

    // Bloquear filas relevantes para la fecha (FOR UPDATE impide inserciones concurrentes)
    $pdo->prepare("SELECT id FROM reservas WHERE fecha = ? AND estado IN ('Pendiente','Aprobada') FOR UPDATE")
        ->execute([$fechaSolo]);

    // ── Verificar que el usuario no tiene ya una reserva solapada ese día ────
    $stmtProp = $pdo->prepare("
        SELECT espacio FROM reservas
        WHERE usuario_id = ? AND fecha = ? AND estado IN ('Pendiente','Aprobada')
          AND (? < hora_fin AND ? > hora_inicio)
    ");
    $stmtProp->execute([$userId, $fechaSolo, $horaInicio, $horaFin]);
    if ($stmtProp->fetch()) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => 'Ya tienes una reserva en ese horario.']); exit;
    }

    // ── Verificar disponibilidad del espacio ─────────────────────────────────
    $check = verificarDisponibilidad($pdo, $espacio, $fechaSolo, $horaInicio, $horaFin);
    if (!$check['disponible']) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => $check['mensaje']]); exit;
    }

    // ── Insertar reserva ─────────────────────────────────────────────────────
    $stmt = $pdo->prepare("
        INSERT INTO reservas (usuario_id, fecha, hora_inicio, hora_fin, espacio, requisitos, estado)
        VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')
    ");
    $stmt->execute([$userId, $fechaSolo, $horaInicio, $horaFin, $espacio, $requisitos ?: null]);
    $reservaId = (int)$pdo->lastInsertId();

    // ── Guardar recursos seleccionados ───────────────────────────────────────
    if (!empty($recursosValidos)) {
        $stmtRec = $pdo->prepare("INSERT IGNORE INTO reserva_recursos (reserva_id, recurso_id, cantidad) VALUES (?, ?, ?)");
        foreach ($recursosValidos as $rec) {
            $stmtRec->execute([$reservaId, $rec['id'], $rec['cantidad']]);
        }
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Reserva registrada. Quedará pendiente de aprobación.']);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('nueva_reserva: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al registrar la reserva.']);
}
