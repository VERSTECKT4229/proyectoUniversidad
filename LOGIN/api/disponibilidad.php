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
        $reservasCompletas[] = $reserva;
        
        // Si hay reserva de B3, agregar reservas "virtuales" de B1 y B2
        if ($reserva['espacio'] === 'B3') {
            $reservasCompletas[] = [
                'espacio' => 'B1',
                'fecha' => $reserva['fecha'],
                'hora_inicio' => $reserva['hora_inicio'],
                'hora_fin' => $reserva['hora_fin']
            ];
            $reservasCompletas[] = [
                'espacio' => 'B2',
                'fecha' => $reserva['fecha'],
                'hora_inicio' => $reserva['hora_inicio'],
                'hora_fin' => $reserva['hora_fin']
            ];
        }
        
        // Si hay reserva de B1 o B2, agregar reserva "virtual" de B3
        // (para indicar que B3 no está disponible si B1 o B2 está ocupado)
        if ($reserva['espacio'] === 'B1' || $reserva['espacio'] === 'B2') {
            $reservasCompletas[] = [
                'espacio' => 'B3',
                'fecha' => $reserva['fecha'],
                'hora_inicio' => $reserva['hora_inicio'],
                'hora_fin' => $reserva['hora_fin']
            ];
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