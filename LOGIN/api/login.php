<?php
ini_set('display_errors', 0);
error_reporting(0);

header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$email = trim($data['email'] ?? '');
$password = (string)($data['password'] ?? '');

if ($email === '' || $password === '') {
    echo json_encode(['success' => false, 'message' => 'Email y contraseña requeridos']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Email no válido']);
    exit;
}

try {
    $stmt = $pdo->prepare(
        'SELECT id, nombre, email, password, rol, failed_attempts, locked_until
         FROM usuarios
         WHERE email = ?
         LIMIT 1'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Usuario no encontrado']);
        exit;
    }

$rolesPermitidos = ['administrativo', 'docente', 'externo', 'practicante'];
    $rol = trim((string)($user['rol'] ?? ''));

    if (!in_array($rol, $rolesPermitidos, true)) {
        echo json_encode(['success' => false, 'message' => 'Rol no permitido']);
        exit;
    }

    $requiresDomain = in_array($rol, ['administrativo', 'docente'], true);
    if ($requiresDomain && !is_local_request()) {
        if (!preg_match('/^[A-Za-z0-9._%+\-]+@poligran\.edu\.co$/i', (string)$user['email'])) {
            echo json_encode([
                'success' => false,
                'message' => 'Acceso bloqueado: para este rol se requiere correo @poligran.edu.co'
            ]);
            exit;
        }
    }

    $userId = (int)($user['id'] ?? 0);
    $failedAttempts = (int)($user['failed_attempts'] ?? 0);
    $lockedUntil = $user['locked_until'] ?? null;
    $passDb = (string)($user['password'] ?? '');
    $now = date('Y-m-d H:i:s');

    if (!empty($lockedUntil) && $lockedUntil > $now) {
        $remaining = max(1, strtotime($lockedUntil) - strtotime($now));
        echo json_encode([
            'success' => false,
            'locked' => true,
            'remaining' => $remaining,
            'message' => 'Tu cuenta ha sido bloqueada. Espera ' . $remaining . ' segundos.'
        ]);
        exit;
    }

    if (!empty($lockedUntil) && $lockedUntil <= $now) {
        $reset = $pdo->prepare('UPDATE usuarios SET failed_attempts = 0, locked_until = NULL WHERE id = ?');
        $reset->execute([$userId]);
        $failedAttempts = 0;
    }

    $valid = false;
    if ($passDb !== '' && password_verify($password, $passDb)) {
        $valid = true;
    } elseif ($password === $passDb) {
        $valid = true;
    }

    if (!$valid) {
        $newAttempts = $failedAttempts + 1;
        $maxAttempts = 4;

        if ($newAttempts >= $maxAttempts) {
            $lockSeconds = 5;
            $lockTime = date('Y-m-d H:i:s', strtotime('+' . $lockSeconds . ' seconds'));
            $upd = $pdo->prepare('UPDATE usuarios SET failed_attempts = ?, locked_until = ? WHERE id = ?');
            $upd->execute([$newAttempts, $lockTime, $userId]);

            echo json_encode([
                'success' => false,
                'locked' => true,
                'remaining' => $lockSeconds,
                'message' => 'Tu cuenta ha sido bloqueada. Espera 5 segundos.'
            ]);
        } else {
            $remainingAttempts = $maxAttempts - $newAttempts;
            $upd = $pdo->prepare('UPDATE usuarios SET failed_attempts = ? WHERE id = ?');
            $upd->execute([$newAttempts, $userId]);

            echo json_encode([
                'success' => false,
                'message' => 'Credenciales incorrectas. Te quedan ' . $remainingAttempts . ' intento(s)'
            ]);
        }
        exit;
    }

    $reset = $pdo->prepare('UPDATE usuarios SET failed_attempts = 0, locked_until = NULL WHERE id = ?');
    $reset->execute([$userId]);

    $_SESSION['user'] = [
        'id' => $userId,
        'nombre' => $user['nombre'] ?? '',
        'email' => $user['email'] ?? '',
        'rol' => $rol
    ];

    echo json_encode([
        'success' => true,
        'message' => 'Inicio de sesión exitoso',
        'redirect' => 'dashboard.php',
        'user' => $_SESSION['user']
    ]);
} catch (Throwable $e) {
    error_log('login.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error interno en login'
    ]);
}
