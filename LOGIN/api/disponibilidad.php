<?php
header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';
require_auth_api();

$fecha = $_GET['fecha'] ?? date('Y-m-d');

try {
    // Consultamos todas las reservas para esa fecha que no estén rechazadas
    $sql = "SELECT espacio, hora_inicio, hora_fin 
            FROM reservas 
            WHERE fecha = ? AND estado IN ('Pendiente', 'Aprobada')";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$fecha]);
    $reservas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'reservas' => $reservas
    ]);
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener disponibilidad'
    ]);
}