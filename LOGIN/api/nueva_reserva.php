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

$data = json_decode(file_get_contents('php://input'), true);

$fecha = trim($data['fecha'] ?? '');
$horaInicio = trim($data['hora_inicio'] ?? '');
$horaFin = trim($data['hora_fin'] ?? '');
$espacio = trim($data['espacio'] ?? '');
$requisitos = trim($data['requisitos_adicionales'] ?? '');
$userId = (int)($_SESSION['user']['id'] ?? 0);
$userEmail = (string)($_SESSION['user']['email'] ?? '');
$userNombre = (string)($_SESSION['user']['nombre'] ?? '');

$espaciosValidos = ['B1', 'B2', 'B3'];

if ($fecha === '' || $horaInicio === '' || $horaFin === '' || !in_array($espacio, $espaciosValidos, true)) {
    echo json_encode(['success' => false, 'message' => 'Datos incompletos o inválidos']);
    exit;
}

// Limpiar fecha de cualquier componente de hora y validar 24h
$fechaSolo = explode(' ', $fecha)[0];
$timestampReserva = strtotime("$fechaSolo $horaInicio");
if ($timestampReserva < (time() + 86400)) {
    echo json_encode(['success' => false, 'message' => 'Las reservas deben realizarse con al menos 24 horas de antelación']);
    exit;
}

if ($horaInicio >= $horaFin) {
    echo json_encode(['success' => false, 'message' => 'La hora inicio debe ser menor a la hora fin']);
    exit;
}

function hasConflict(PDO $pdo, string $espacio, string $fecha, string $horaInicio, string $horaFin): bool
{
    $sql = "SELECT COUNT(*) AS total
            FROM reservas
            WHERE espacio = ?
              AND fecha = ?
              AND estado IN ('Pendiente', 'Aprobada')
              AND (? < hora_fin AND ? > hora_inicio)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$espacio, $fecha, $horaInicio, $horaFin]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return ((int)($row['total'] ?? 0)) > 0;
}

try {
    if (hasConflict($pdo, $espacio, $fecha, $horaInicio, $horaFin)) {
        echo json_encode([
            'success' => false,
            'message' => 'No hay disponibilidad para el espacio seleccionado'
        ]);
        exit;
    }

    $stmt = $pdo->prepare(
        "INSERT INTO reservas (usuario_id, fecha, hora_inicio, hora_fin, espacio, requisitos, estado)
         VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')"
    );
    $stmt->execute([$userId, $fechaSolo, $horaInicio, $horaFin, $espacio, $requisitos]);

    echo json_encode([
        'success' => true,
        'message' => 'Reserva registrada en estado Pendiente'
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al registrar la reserva'
    ]);
}
