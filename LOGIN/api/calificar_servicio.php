<?php
/**
 * calificar_servicio.php
 * API para recibir calificaciones del servicio y enviar por correo al administrador.
 */

header('Content-Type: application/json');
require_once '../config.php';
require_once '../session.php';
require_once './mail_helper.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $calificacion = isset($data['calificacion']) ? (int)$data['calificacion'] : 0;
    $comentario = isset($data['comentario']) ? trim($data['comentario']) : '';
    $nombreUsuario = isset($_SESSION['user']['nombre']) ? $_SESSION['user']['nombre'] : 'Usuario';
    $emailUsuario = isset($_SESSION['user']['email']) ? $_SESSION['user']['email'] : 'No registrado';

    // Validar calificación
    if ($calificacion < 1 || $calificacion > 10) {
        echo json_encode([
            'success' => false,
            'message' => 'La calificación debe ser entre 1 y 10'
        ]);
        exit;
    }

    // Construir correo de notificación de calificación
    $subject = "📊 Nueva Calificación de Servicio: {$calificacion}/10";
    
    $body = build_calification_email($nombreUsuario, $emailUsuario, $calificacion, $comentario);

    // Enviar al administrador
    $adminEmail = 'danielbenitezm4229@gmail.com';
    $error = null;
    $sent = send_system_email($adminEmail, $subject, $body, $error);

    if ($sent) {
        echo json_encode([
            'success' => true,
            'message' => 'Gracias por tu calificación'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Error al enviar la calificación: ' . ($error ?? 'desconocido')
        ]);
    }

} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error interno: ' . $e->getMessage()
    ]);
}

/**
 * Construye el HTML del correo de calificación
 */
function build_calification_email(string $nombre, string $email, int $calificacion, string $comentario): string
{
    $fecha = date('d/m/Y H:i:s');
    $estrellas = str_repeat('⭐', $calificacion);
    $comentarioHtml = $comentario ? nl2br(htmlspecialchars($comentario)) : 'Sin comentario';
    
    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f7ff; margin: 0; padding: 20px; }
    .card { background: #fff; border-radius: 10px; max-width: 520px; margin: auto;
            padding: 32px; box-shadow: 0 4px 18px rgba(0,0,0,0.10); }
    .header { background: #1a237e; color: #fff; border-radius: 8px 8px 0 0;
              padding: 20px 24px; text-align: center; }
    .rating { text-align: center; font-size: 36px; margin: 20px 0; }
    .rating-number { display: inline-block; background: #1a237e; color: #fff;
                  border-radius: 50%; width: 80px; height: 80px; line-height: 80px;
                  font-size: 32px; font-weight: bold; }
    .detail { background: #f0f4ff; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    .detail p { margin: 8px 0; font-size: 15px; color: #333; }
    .detail strong { color: #1a237e; }
    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>📊 Calificación de Servicio</h1>
    </div>
    <div style="padding: 24px;">
      <div class="rating">
        <div class="rating-number">{$calificacion}/10</div>
        <div style="font-size: 24px; margin-top: 8px;">{$estrellas}</div>
      </div>
      <div class="detail">
        <p>👤 <strong>Usuario:</strong> {$nombre}</p>
        <p>📧 <strong>Email:</strong> {$email}</p>
        <p>📅 <strong>Fecha:</strong> {$fecha}</p>
        <p>💬 <strong>Comentario:</strong></p>
        <p style="font-style: italic; color: #555;">{$comentarioHtml}</p>
      </div>
    </div>
    <div class="footer">
      Sistema de Reservas Poli &mdash; Correo automático.
    </div>
  </div>
</body>
</html>
HTML;
}
