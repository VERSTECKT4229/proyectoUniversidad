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
$espacio = strtoupper(trim($data['espacio'] ?? ''));
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

// Validar que no sea martes (2) ni jueves (4)
$fechaObj = new DateTime($fechaSolo);
$diaSemana = $fechaObj->format('N'); // 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, etc.
if ($diaSemana === '2' || $diaSemana === '4') {
    echo json_encode(['success' => false, 'message' => 'No se permiten reservas los martes ni jueves']);
    exit;
}

$timestampReserva = strtotime("$fechaSolo $horaInicio");
if ($timestampReserva < (time() + 86400)) {
    echo json_encode(['success' => false, 'message' => 'Las reservas deben realizarse con al menos 24 horas de antelación']);
    exit;
}

if ($horaInicio >= $horaFin) {
    echo json_encode(['success' => false, 'message' => 'La hora inicio debe ser menor a la hora fin']);
    exit;
}

if ($horaInicio < '07:00' || $horaFin > '20:00') {
    echo json_encode(['success' => false, 'message' => 'Las reservas deben realizarse entre las 07:00 y las 20:00']);
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

function verificarDisponibilidadEspacioNueva(PDO $pdo, string $espacio, string $fecha, string $horaInicio, string $horaFin): array
{
    // Reglas:
    // - B1 y B2 son INDEPENDIENTES entre sí
    // - B3 es la combinación de B1+B2, requiere AMBOS libres
    // - No se puede reservar un espacio si ya hay reserva en ese horario
    
    if ($espacio === 'B3') {
        // Para B3, debe haber disponibilidad en B1 Y B2
        if (hasConflict($pdo, 'B1', $fecha, $horaInicio, $horaFin)) {
            return ['disponible' => false, 'mensaje' => 'No se puede reservar B3 porque B1 ya está ocupado en ese horario'];
        }
        if (hasConflict($pdo, 'B2', $fecha, $horaInicio, $horaFin)) {
            return ['disponible' => false, 'mensaje' => 'No se puede reservar B3 porque B2 ya está ocupado en ese horario'];
        }
        if (hasConflict($pdo, 'B3', $fecha, $horaInicio, $horaFin)) {
            return ['disponible' => false, 'mensaje' => 'B3 ya está ocupado en ese horario'];
        }
    } elseif ($espacio === 'B1' || $espacio === 'B2') {
        // Para B1 o B2: no se puede si hay conflicto en ese espacio
        // PERO también se bloquea si B3 está ocupado en ese horario
        if (hasConflict($pdo, $espacio, $fecha, $horaInicio, $horaFin)) {
            return ['disponible' => false, 'mensaje' => "El espacio {$espacio} ya está ocupado en ese horario"];
        }
        if (hasConflict($pdo, 'B3', $fecha, $horaInicio, $horaFin)) {
            return ['disponible' => false, 'mensaje' => "No se puede reservar {$espacio} porque B3 (combinación de espacios) ya está ocupado en ese horario"];
        }
    }
    
    return ['disponible' => true, 'mensaje' => 'Disponible'];
}

try {
    // Verificar disponibilidad del espacio
    $resultado = verificarDisponibilidadEspacioNueva($pdo, $espacio, $fechaSolo, $horaInicio, $horaFin);
    if (!$resultado['disponible']) {
        echo json_encode([
            'success' => false,
            'message' => $resultado['mensaje']
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
        'message' => 'Error al registrar la reserva: ' . $e->getMessage()
    ]);
}
?>