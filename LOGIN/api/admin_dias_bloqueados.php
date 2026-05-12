<?php
header('Content-Type: application/json');
require_once '../session.php';
require_once '../config.php';
require_auth_api();

$me = $_SESSION['user'];
if ($me['rol'] !== 'administrativo') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Acceso denegado']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, fecha, motivo, created_at FROM dias_bloqueados ORDER BY fecha ASC");
    echo json_encode(['success' => true, 'dias' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

} elseif ($method === 'POST') {
    $fecha  = trim($body['fecha']  ?? '');
    $motivo = trim($body['motivo'] ?? '');

    if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        echo json_encode(['success' => false, 'message' => 'Fecha inválida.']); exit;
    }
    // No bloquear fechas pasadas
    if ($fecha < date('Y-m-d')) {
        echo json_encode(['success' => false, 'message' => 'No se pueden bloquear fechas pasadas.']); exit;
    }

    try {
        $pdo->prepare("INSERT INTO dias_bloqueados (fecha, motivo) VALUES (?, ?)")->execute([$fecha, $motivo]);
        echo json_encode(['success' => true, 'message' => 'Día bloqueado correctamente.']);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            echo json_encode(['success' => false, 'message' => 'Ese día ya está bloqueado.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al bloquear el día.']);
        }
    }

} elseif ($method === 'DELETE') {
    $id = intval($body['id'] ?? 0);
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID inválido.']); exit; }
    $pdo->prepare("DELETE FROM dias_bloqueados WHERE id = ?")->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Día desbloqueado.']);

} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
}
