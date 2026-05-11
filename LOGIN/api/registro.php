<?php
header('Content-Type: application/json');
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$nombre = trim($data['nombre'] ?? '');
$email = trim($data['email'] ?? '');
$password = (string)($data['password'] ?? '');
$confirmPassword = (string)($data['confirm_password'] ?? '');
$rol = trim($data['rol'] ?? '');

$rolesPermitidos = ['administrativo', 'docente', 'externo', 'practicante'];

if ($nombre === '' || $email === '' || $password === '' || $confirmPassword === '' || $rol === '') {
    echo json_encode(['success' => false, 'message' => 'Todos los campos son obligatorios']);
    exit;
}

if (!in_array($rol, $rolesPermitidos, true)) {
    echo json_encode(['success' => false, 'message' => 'Rol no permitido']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Email no válido']);
    exit;
}

if (in_array($rol, ['administrativo', 'docente'], true) && !is_local_request()) {
    if (!preg_match('/^[A-Za-z0-9._%+\-]+@poligran\.edu\.co$/i', $email)) {
        echo json_encode([
            'success' => false,
            'message' => 'Para este rol debes usar un correo @poligran.edu.co'
        ]);
        exit;
    }
}

if ($password !== $confirmPassword) {
    echo json_encode(['success' => false, 'message' => 'Las contraseñas no coinciden']);
    exit;
}

try {
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'El email ya está registrado']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    $insert = $pdo->prepare(
        'INSERT INTO usuarios (nombre, email, password, rol, failed_attempts, locked_until)
         VALUES (?, ?, ?, ?, 0, NULL)'
    );
    $insert->execute([$nombre, $email, $hash, $rol]);

    echo json_encode([
        'success' => true,
        'message' => 'Registro exitoso. Ya puedes iniciar sesión.'
    ]);
} catch (Throwable $e) {
    error_log("Error en registro: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al registrar usuario'
    ]);
}
