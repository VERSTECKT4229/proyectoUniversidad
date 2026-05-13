<?php
require_once '../session.php';
require_once '../config.php';
require_auth_api();

$me = $_SESSION['user'];
if (!in_array($me['rol'], ['administrativo', 'coordinador'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Acceso denegado']);
    exit;
}

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, nombre, descripcion, cantidad, created_at FROM recursos ORDER BY nombre ASC");
    echo json_encode(['success' => true, 'recursos' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

} elseif ($method === 'POST') {
    $nombre      = trim($body['nombre']      ?? '');
    $descripcion = trim($body['descripcion'] ?? '');
    $cantidad    = intval($body['cantidad']  ?? 0);

    if (!$nombre) {
        echo json_encode(['success' => false, 'message' => 'El nombre es obligatorio.']); exit;
    }
    if ($cantidad < 0) {
        echo json_encode(['success' => false, 'message' => 'La cantidad no puede ser negativa.']); exit;
    }

    $stmt = $pdo->prepare("INSERT INTO recursos (nombre, descripcion, cantidad) VALUES (?, ?, ?)");
    $stmt->execute([$nombre, $descripcion, $cantidad]);
    echo json_encode(['success' => true, 'message' => 'Recurso creado.', 'id' => (int)$pdo->lastInsertId()]);

} elseif ($method === 'PUT') {
    $id          = intval($body['id']        ?? 0);
    $nombre      = trim($body['nombre']      ?? '');
    $descripcion = trim($body['descripcion'] ?? '');
    $cantidad    = intval($body['cantidad']  ?? 0);

    if (!$id || !$nombre) {
        echo json_encode(['success' => false, 'message' => 'Datos inválidos.']); exit;
    }
    if ($cantidad < 0) {
        echo json_encode(['success' => false, 'message' => 'La cantidad no puede ser negativa.']); exit;
    }

    $stmt = $pdo->prepare("UPDATE recursos SET nombre = ?, descripcion = ?, cantidad = ? WHERE id = ?");
    $stmt->execute([$nombre, $descripcion, $cantidad, $id]);
    echo json_encode(['success' => true, 'message' => 'Recurso actualizado.']);

} elseif ($method === 'DELETE') {
    $id = intval($body['id'] ?? 0);
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID inválido.']); exit; }

    $stmt = $pdo->prepare("DELETE FROM recursos WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Recurso eliminado.']);

} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
}
