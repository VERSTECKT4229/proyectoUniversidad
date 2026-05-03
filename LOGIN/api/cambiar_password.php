<?php
header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';
require_auth_api();

$userId = $_SESSION['user']['id'];
$currentPass = $_POST['current_password'] ?? '';
$newPass = $_POST['new_password'] ?? '';
$confirmPass = $_POST['confirm_password'] ?? '';

if ($newPass !== $confirmPass) {
    echo json_encode(['success' => false, 'message' => 'Las nuevas contraseñas no coinciden']);
    exit;
}

if (strlen($newPass) < 8) {
    echo json_encode(['success' => false, 'message' => 'La nueva contraseña debe tener al menos 8 caracteres']);
    exit;
}

$stmt = $pdo->prepare("SELECT password FROM usuarios WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!password_verify($currentPass, $user['password'])) {
    echo json_encode(['success' => false, 'message' => 'Contraseña actual incorrecta']);
    exit;
}

$hash = password_hash($newPass, PASSWORD_DEFAULT);
$stmt = $pdo->prepare("UPDATE usuarios SET password = ? WHERE id = ?");
$stmt->execute([$hash, $userId]);

echo json_encode(['success' => true, 'message' => 'Contraseña cambiada exitosamente']);
?>
