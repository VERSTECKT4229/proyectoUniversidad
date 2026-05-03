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
$espacio     = trim($data['espacio'] ?? '');
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

    function hayConflicto($pdo, $espacio, $fecha, $inicio, $fin) {
        $sql = "SELECT COUNT(*) FROM reservas 
                WHERE espacio = ? AND fecha = ? 
                AND estado IN ('Pendiente', 'Aprobada')
                AND (hora_inicio < ? AND hora_fin > ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$espacio, $fecha, $fin, $inicio]);
        return $stmt->fetchColumn() > 0;
    }

    // Lógica B3: requiere B1 y B2 libres
    if ($espacio === 'B3') {
        if (hayConflicto($pdo, 'B1', $fecha, $hora_inicio, $hora_fin) || 
            hayConflicto($pdo, 'B2', $fecha, $hora_inicio, $hora_fin)) {
            echo json_encode(['success' => false, 'message' => 'B3 requiere disponibilidad de B1 y B2']);
            exit;
        }
    }

    if (hayConflicto($pdo, $espacio, $fecha, $hora_inicio, $hora_fin)) {
        echo json_encode(['success' => false, 'message' => 'El espacio ya está ocupado en ese horario']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO reservas (usuario_id, fecha, hora_inicio, hora_fin, espacio, requisitos, estado) VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')");
    $stmt->execute([$usuario_id, $fecha, $hora_inicio, $hora_fin, $espacio, $requisitos]);

    echo json_encode(['success' => true, 'message' => 'Reserva creada y pendiente de aprobación']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
