<?php
header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';
require_auth_api();

$fecha = $_GET['fecha'] ?? date('Y-m-d');

try {
    // Consultamos todas las reservas para esa fecha que no estén rechazadas
    $sql = "SELECT espacio, fecha, hora_inicio, hora_fin
            FROM reservas
            WHERE fecha = ? AND estado IN ('Pendiente', 'Aprobada')";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$fecha]);
    $reservasArray = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Procesar reservas considerando dependencias
    // B3 bloqueará a B1 y B2, y B1/B2 bloquearán a B3
    $reservasCompletas = [];
    
    foreach ($reservasArray as $reserva) {
        // Reserva real
        $reservasCompletas[] = array_merge($reserva, ['tipo' => 'ocupado']);

        if ($reserva['espacio'] === 'B3') {
            // B3 ocupado → B1 y B2 quedan bloqueados
            $reservasCompletas[] = ['espacio' => 'B1', 'fecha' => $reserva['fecha'], 'hora_inicio' => $reserva['hora_inicio'], 'hora_fin' => $reserva['hora_fin'], 'tipo' => 'bloqueado'];
            $reservasCompletas[] = ['espacio' => 'B2', 'fecha' => $reserva['fecha'], 'hora_inicio' => $reserva['hora_inicio'], 'hora_fin' => $reserva['hora_fin'], 'tipo' => 'bloqueado'];
        } elseif ($reserva['espacio'] === 'B1' || $reserva['espacio'] === 'B2') {
            // B1 o B2 ocupado → B3 queda bloqueado
            $reservasCompletas[] = ['espacio' => 'B3', 'fecha' => $reserva['fecha'], 'hora_inicio' => $reserva['hora_inicio'], 'hora_fin' => $reserva['hora_fin'], 'tipo' => 'bloqueado'];
        }
    }

    echo json_encode([
        'success' => true,
        'reservas' => $reservasCompletas
    ]);
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener disponibilidad'
    ]);
}