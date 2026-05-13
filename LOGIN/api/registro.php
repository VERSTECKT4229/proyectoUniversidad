<?php
header('Content-Type: application/json');
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];

$nombre          = trim($data['nombre']           ?? '');
$email           = trim($data['email']            ?? '');
$password        = (string)($data['password']     ?? '');
$confirmPassword = (string)($data['confirm_password'] ?? '');
$rol             = trim($data['rol']              ?? '');
$codigoInput     = strtoupper(trim($data['codigo_invitacion'] ?? ''));

// Solo docente, externo y practicante pueden auto-registrarse
$rolesPublicos = ['docente', 'externo', 'practicante'];

if ($nombre === '' || $email === '' || $password === '' || $confirmPassword === '' || $rol === '') {
    echo json_encode(['success' => false, 'message' => 'Todos los campos son obligatorios']);
    exit;
}

if ($codigoInput === '') {
    echo json_encode(['success' => false, 'message' => 'Se requiere un código de invitación para registrarse.']);
    exit;
}

if (!in_array($rol, $rolesPublicos, true)) {
    echo json_encode(['success' => false, 'message' => 'Ese rol no se puede registrar por aquí. Contacta al administrador.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Email no válido']);
    exit;
}

if (in_array($rol, ['docente'], true) && !is_local_request()) {
    if (!preg_match('/^[A-Za-z0-9._%+\-]+@poligran\.edu\.co$/i', $email)) {
        echo json_encode([
            'success' => false,
            'message' => 'Los docentes deben usar un correo @poligran.edu.co'
        ]);
        exit;
    }
}

if (strlen($nombre) > 100) {
    echo json_encode(['success' => false, 'message' => 'El nombre no puede superar los 100 caracteres']);
    exit;
}

if (strlen($email) > 254) {
    echo json_encode(['success' => false, 'message' => 'Email no válido']);
    exit;
}

if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'message' => 'La contraseña debe tener al menos 8 caracteres']);
    exit;
}

if (strlen($password) > 1024) {
    echo json_encode(['success' => false, 'message' => 'Contraseña demasiado larga']);
    exit;
}

if ($password !== $confirmPassword) {
    echo json_encode(['success' => false, 'message' => 'Las contraseñas no coinciden']);
    exit;
}

try {
    // ── Validar código de invitación ─────────────────────────────────────────
    $stmtCod = $pdo->prepare("
        SELECT id, rol_permitido, usos_maximos, usos_actuales
        FROM codigos_invitacion
        WHERE codigo = ? AND activo = 1
        LIMIT 1
    ");
    $stmtCod->execute([$codigoInput]);
    $codigo = $stmtCod->fetch(PDO::FETCH_ASSOC);

    if (!$codigo) {
        echo json_encode(['success' => false, 'message' => 'Código de invitación inválido o inactivo.']);
        exit;
    }

    if ((int)$codigo['usos_actuales'] >= (int)$codigo['usos_maximos']) {
        echo json_encode(['success' => false, 'message' => 'Este código ya alcanzó el límite de usos.']);
        exit;
    }

    if ($codigo['rol_permitido'] !== null && $codigo['rol_permitido'] !== $rol) {
        echo json_encode([
            'success' => false,
            'message' => 'Este código solo es válido para el rol: ' . $codigo['rol_permitido'] . '.'
        ]);
        exit;
    }

    // ── Verificar email único ────────────────────────────────────────────────
    $stmtCheck = $pdo->prepare('SELECT id FROM usuarios WHERE email = ? LIMIT 1');
    $stmtCheck->execute([$email]);
    if ($stmtCheck->fetch()) {
        echo json_encode(['success' => false, 'message' => 'El email ya está registrado']);
        exit;
    }

    // ── Insertar usuario y consumir código (transacción) ─────────────────────
    $pdo->beginTransaction();

    $hash   = password_hash($password, PASSWORD_DEFAULT);
    $insert = $pdo->prepare(
        'INSERT INTO usuarios (nombre, email, password, rol, failed_attempts, locked_until)
         VALUES (?, ?, ?, ?, 0, NULL)'
    );
    $insert->execute([$nombre, $email, $hash, $rol]);

    $pdo->prepare("UPDATE codigos_invitacion SET usos_actuales = usos_actuales + 1 WHERE id = ?")
        ->execute([$codigo['id']]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Registro exitoso. Ya puedes iniciar sesión.'
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Error en registro: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al registrar usuario'
    ]);
}
