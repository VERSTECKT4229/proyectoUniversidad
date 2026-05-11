<?php
header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';
require_auth_api();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$usuario_id  = (int)($_SESSION['user']['id'] ?? 0);
$fecha       = trim($data['fecha'] ?? '');
$hora_inicio = trim($data['hora_inicio'] ?? '');
$hora_fin    = trim($data['hora_fin'] ?? '');
$espacio     = strtoupper(trim($data['espacio'] ?? ''));
$requisitos  = trim($data['requisitos'] ?? '');

if ($usuario_id <= 0 || $fecha === '' || $hora_inicio === '' || $hora_fin === '' || $espacio === '') {
    echo json_encode(['success' => false, 'message' => 'Faltan campos obligatorios']);
    exit;
}

if ($hora_inicio >= $hora_fin) {
    echo json_encode(['success' => false, 'message' => 'La hora inicio debe ser menor a hora fin']);
    exit;
}

try {
    $hoy = new DateTime('today');
    $max = (new DateTime('today'))->modify('+3 months');
    $fechaObj = new DateTime($fecha); // Soporta YYYY-MM-DD
    
    if ($fechaObj < $hoy || $fechaObj > $max) {
        echo json_encode(['success' => false, 'message' => 'La fecha debe estar entre hoy y los próximos 3 meses']);
        exit;
    }

    // Validar que no sea martes (2) ni jueves (4)
    $diaSemana = $fechaObj->format('N'); // 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, etc.
    if ($diaSemana === '2' || $diaSemana === '4') {
        echo json_encode(['success' => false, 'message' => 'No se permiten reservas los martes ni jueves']);
        exit;
    }

    function hayConflicto($pdo, $espacio, $fecha, $inicio, $fin) {
        $sql = "SELECT COUNT(*) FROM reservas 
                WHERE UPPER(espacio) = UPPER(?) AND fecha = ? 
                AND estado IN ('Pendiente', 'Aprobada')
                AND (hora_inicio < ? AND hora_fin > ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$espacio, $fecha, $fin, $inicio]);
        return $stmt->fetchColumn() > 0;
    }

    function verificarDisponibilidadEspacio($pdo, $espacio, $fecha, $hora_inicio, $hora_fin) {
        // Reglas:
        // - B1 y B2 son INDEPENDIENTES entre sí
        // - B3 es la combinación de B1+B2, requiere AMBOS libres
        // - No se puede reservar un espacio si ya hay reserva en ese horario
        
        if ($espacio === 'B3') {
            // Para B3, debe haber disponibilidad en B1 Y B2
            if (hayConflicto($pdo, 'B1', $fecha, $hora_inicio, $hora_fin)) {
                return ['disponible' => false, 'mensaje' => 'No se puede reservar B3 porque B1 ya está ocupado en ese horario'];
            }
            if (hayConflicto($pdo, 'B2', $fecha, $hora_inicio, $hora_fin)) {
                return ['disponible' => false, 'mensaje' => 'No se puede reservar B3 porque B2 ya está ocupado en ese horario'];
            }
            if (hayConflicto($pdo, 'B3', $fecha, $hora_inicio, $hora_fin)) {
                return ['disponible' => false, 'mensaje' => 'B3 ya está ocupado en ese horario'];
            }
        } elseif ($espacio === 'B1' || $espacio === 'B2') {
            // Para B1 o B2: no se puede si hay conflicto en ese espacio
            // PERO también se bloquea si B3 está ocupado en ese horario
            if (hayConflicto($pdo, $espacio, $fecha, $hora_inicio, $hora_fin)) {
                return ['disponible' => false, 'mensaje' => "El espacio {$espacio} ya está ocupado en ese horario"];
            }
            if (hayConflicto($pdo, 'B3', $fecha, $hora_inicio, $hora_fin)) {
                return ['disponible' => false, 'mensaje' => "No se puede reservar {$espacio} porque B3 (combinación de espacios) ya está ocupado en ese horario"];
            }
        }
        
        return ['disponible' => true, 'mensaje' => 'Disponible'];
    }

    // Verificar disponibilidad
    $resultado = verificarDisponibilidadEspacio($pdo, $espacio, $fecha, $hora_inicio, $hora_fin);
    if (!$resultado['disponible']) {
        echo json_encode([
            'success' => false,
            'message' => $resultado['mensaje']
        ]);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO reservas (usuario_id, fecha, hora_inicio, hora_fin, espacio, requisitos, estado) VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')");
    $stmt->execute([$usuario_id, $fecha, $hora_inicio, $hora_fin, $espacio, $requisitos]);

    echo json_encode(['success' => true, 'message' => 'Reserva creada y pendiente de aprobación']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
