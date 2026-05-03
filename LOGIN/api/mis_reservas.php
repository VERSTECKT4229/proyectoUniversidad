<?php
header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';
require_auth_api();

try {
    $userId = $_SESSION['user']['id'];
    // Obtenemos todas las reservas del usuario, sin importar el estado
    $stmt = $pdo->prepare("SELECT * FROM reservas WHERE usuario_id = ? ORDER BY fecha DESC, hora_inicio ASC");
    $stmt->execute([$userId]);
    $reservas = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'reservas' => $reservas
    ]);
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener tus reservas'
    ]);
}