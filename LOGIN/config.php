<?php
header('Content-Type: application/json');

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: '3306';
$db   = getenv('DB_NAME') ?: 'usuarios';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';
$charset = 'utf8mb4';

function is_local_request(): bool
{
    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
    return in_array($remoteAddr, ['127.0.0.1', '::1'], true);
}

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

function create_pdo(string $host, string $port, string $db, string $user, string $pass, array $options)
{
    $dsn = "mysql:host={$host};port={$port};dbname={$db};charset={$GLOBALS['charset']}";
    return new PDO($dsn, $user, $pass, $options);
}

try {
    $pdo = create_pdo($host, $port, $db, $user, $pass, $options);
} catch (\PDOException $e) {
    if ($host === '127.0.0.1') {
        try {
            $pdo = create_pdo('localhost', $port, $db, $user, $pass, $options);
        } catch (\PDOException $e2) {
            error_log('DB connect error (localhost): ' . $e2->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error de conexión a la base de datos.'
            ]);
            exit;
        }
    } else {
        error_log('DB connect error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error de conexión a la base de datos.'
        ]);
        exit;
    }
}
