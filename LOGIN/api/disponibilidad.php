<?php
header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';
require_auth_api();

$fecha = $_GET['fecha'] ?? date('Y-m-d');

try {
    // Verificar si el día está bloqueado por administración
    $stmtBlq = $pdo->prepare("SELECT motivo FROM dias_bloqueados WHERE fecha = ? LIMIT 1");
    $stmtBlq->execute([$fecha]);
    $diaBloqueado = $stmtBlq->fetch(PDO::FETCH_ASSOC);

    if ($diaBloqueado !== false) {
        echo json_encode([
            'success'         => true,
            'dia_bloqueado'   => true,
            'motivo_bloqueo'  => $diaBloqueado['motivo'] ?? null,
            'reservas'        => []
        ]);
        exit;
    }

    // Consultamos todas las reservas para esa fecha que no estén rechazadas
    $sql = "SELECT espacio, fecha, hora_inicio, hora_fin
            FROM reservas
            WHERE fecha = ? AND estado IN ('Pendiente', 'Aprobada')";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$fecha]);
    $reservasArray = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Solo B1 o B2 ocupados bloquean B3 (no al revés)
    $reservasCompletas = [];

    foreach ($reservasArray as $reserva) {
        $reservasCompletas[] = array_merge($reserva, ['tipo' => 'ocupado']);

        if ($reserva['espacio'] === 'B1' || $reserva['espacio'] === 'B2') {
            // B1 o B2 ocupado → B3 queda bloqueado
            $reservasCompletas[] = [
                'espacio'     => 'B3',
                'fecha'       => $reserva['fecha'],
                'hora_inicio' => $reserva['hora_inicio'],
                'hora_fin'    => $reserva['hora_fin'],
                'tipo'        => 'bloqueado'
            ];
        }
    }

    echo json_encode([
        'success'       => true,
        'dia_bloqueado' => false,
        'reservas'      => $reservasCompletas
    ]);
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener disponibilidad'
    ]);
}
