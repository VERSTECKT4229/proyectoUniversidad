<?php
require_once '../session.php';
require_once '../config.php';
require_auth_api();

$me = $_SESSION['user'];
if ($me['rol'] !== 'administrativo') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Acceso denegado']);
    exit;
}

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

$roles_validos = ['administrativo', 'docente', 'externo', 'practicante'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, nombre, email, rol, created_at FROM usuarios ORDER BY created_at DESC");
    echo json_encode(['success' => true, 'usuarios' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

} elseif ($method === 'POST') {
    $nombre   = trim($body['nombre']   ?? '');
    $email    = trim($body['email']    ?? '');
    $password = $body['password']      ?? '';
    $rol      = $body['rol']           ?? '';

    if (!$nombre || !$email || !$password || !in_array($rol, $roles_validos)) {
        echo json_encode(['success' => false, 'message' => 'Todos los campos son obligatorios.']); exit;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Email inválido.']); exit;
    }
    if (strlen($password) < 8) {
        echo json_encode(['success' => false, 'message' => 'La contraseña debe tener al menos 8 caracteres.']); exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)");
        $stmt->execute([$nombre, $email, password_hash($password, PASSWORD_BCRYPT), $rol]);
        echo json_encode(['success' => true, 'message' => 'Usuario creado.', 'id' => (int)$pdo->lastInsertId()]);
    } catch (PDOException $e) {
        $msg = $e->getCode() === '23000' ? 'El email ya está registrado.' : 'Error al crear usuario.';
        echo json_encode(['success' => false, 'message' => $msg]);
    }

} elseif ($method === 'PUT') {
    $id     = intval($body['id']     ?? 0);
    $nombre = trim($body['nombre']   ?? '');
    $email  = trim($body['email']    ?? '');
    $rol    = $body['rol']           ?? '';

    if (!$id || !$nombre || !$email || !in_array($rol, $roles_validos)) {
        echo json_encode(['success' => false, 'message' => 'Datos inválidos.']); exit;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Email inválido.']); exit;
    }
    // Prevent admin from demoting their own role (would lock themselves out)
    if ($id === intval($me['id']) && $rol !== 'administrativo') {
        echo json_encode(['success' => false, 'message' => 'No puedes cambiar tu propio rol.']); exit;
    }

    try {
        $stmt = $pdo->prepare("UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?");
        $stmt->execute([$nombre, $email, $rol, $id]);
        echo json_encode(['success' => true, 'message' => 'Usuario actualizado.']);
    } catch (PDOException $e) {
        $msg = $e->getCode() === '23000' ? 'El email ya está en uso.' : 'Error al actualizar.';
        echo json_encode(['success' => false, 'message' => $msg]);
    }

} elseif ($method === 'DELETE') {
    $id = intval($body['id'] ?? 0);
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID inválido.']); exit; }
    if ($id === intval($me['id'])) {
        echo json_encode(['success' => false, 'message' => 'No puedes eliminarte a ti mismo.']); exit;
    }

    $stmt = $pdo->prepare("DELETE FROM usuarios WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Usuario eliminado.']);

} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
}
