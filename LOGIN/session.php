<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function require_auth(): void
{
    if (empty($_SESSION['user'])) {
        header('Location: index.html');
        exit;
    }
}

function require_auth_api(): void
{
    if (empty($_SESSION['user'])) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'No autorizado'
        ]);
        exit;
    }
}
