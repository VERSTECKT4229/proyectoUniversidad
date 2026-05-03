<?php
// Evitar que avisos de PHP ensucien la respuesta JSON
ini_set('display_errors', 0);
error_reporting(0);

header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';
require_auth_api();

try {
    // Verificar que el usuario tenga rol de administrador o administrativo
    if (!isset($_SESSION['user']['rol']) || !in_array($_SESSION['user']['rol'], ['administrador', 'administrativo'])) {
        throw new Exception("Acceso denegado: No tienes permisos de administrador.");
    }

    // Consultamos reservas pendientes con el nombre del usuario
    $stmt = $pdo->prepare("
        SELECT r.*, u.nombre AS usuario 
        FROM reservas r 
        JOIN usuarios u ON r.usuario_id = u.id 
        WHERE r.estado = 'Pendiente' 
        ORDER BY r.fecha ASC
    ");
    $stmt->execute();
    $pendientes = $stmt->fetchAll();

    echo json_encode([
        'success' => true, 
        'pendientes' => $pendientes ?: []
    ]);
} catch (Throwable $e) {
    error_log("Admin Pending Error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}