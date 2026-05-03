<?php
header('Content-Type: application/json');
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$email = trim($data['email'] ?? '');
$newPass = $data['new_password'] ?? '';
$confirmPass = $data['confirm_password'] ?? '';

if ($email === '' || $newPass === '' || $confirmPass === '') {
    echo json_encode(['success' => false, 'message' => 'Email no válido']);
    exit;
}

try {
    $stmt = $pdo->prepare('SELECT id, nombre, email FROM usuarios WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'No existe una cuenta con ese correo']);
        exit;
    }

    if (strlen($newPass) < 8) {
        echo json_encode(['success' => false, 'message' => 'La clave debe tener 8+ caracteres']);
        exit;
    }

    if ($newPass !== $confirmPass) {
        echo json_encode(['success' => false, 'message' => 'Las claves no coinciden']);
        exit;
    }

    $hash = password_hash($newPass, PASSWORD_DEFAULT);
    $update = $pdo->prepare('UPDATE usuarios SET password = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?');
    $update->execute([$hash, $user['id']]);

    echo json_encode([
        'success' => true,
        'message' => 'Contraseña actualizada. Ya puedes entrar.'
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error interno en recuperación de contraseña'
    ]);
}
