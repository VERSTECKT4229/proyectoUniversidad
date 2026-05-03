<?php
/**
 * mail_helper.php
 * Funciones de envío de correo para el Sistema de Reservas.
 * Usa PHPMailer si está disponible; si no, usa mail() nativo de PHP.
 * Siempre guarda una copia en mail_log.txt para debugging.
 */

// ============================================================
// CARGA CONDICIONAL DE PHPMAILER (no falla si no está instalado)
// ============================================================
$_phpmailerAvailable = false;
if (
    file_exists(__DIR__ . '/PHPMailer/src/Exception.php') &&
    file_exists(__DIR__ . '/PHPMailer/src/PHPMailer.php') &&
    file_exists(__DIR__ . '/PHPMailer/src/SMTP.php')
) {
    require_once __DIR__ . '/PHPMailer/src/Exception.php';
    require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
    require_once __DIR__ . '/PHPMailer/src/SMTP.php';
    $_phpmailerAvailable = true;
}

// ============================================================
// CONFIGURACIÓN DEL REMITENTE
// Cambia estos valores cuando tengas credenciales reales.
// ============================================================
define('MAIL_FROM',     'tu_correo@gmail.com');
define('MAIL_FROM_NAME','Sistema de Reservas Poligran');
define('MAIL_PASSWORD', 'tu_clave_de_aplicacion'); // Contraseña de Aplicación de Google
define('MAIL_LOG_PATH', __DIR__ . '/mail_log.txt');

// ============================================================
// FUNCIÓN PRINCIPAL: send_system_email()
// ============================================================
/**
 * Envía un correo electrónico.
 * Intenta PHPMailer/SMTP si está configurado; si no, usa mail() nativo.
 * Siempre registra en mail_log.txt.
 *
 * @param string      $to      Dirección de destino
 * @param string      $subject Asunto del correo
 * @param string      $body    Cuerpo HTML del correo
 * @param string|null $error   Variable de salida para mensajes de error
 * @return bool
 */
function send_system_email(string $to, string $subject, string $body, ?string &$error = null): bool
{
    global $_phpmailerAvailable;

    // --- Siempre guardar en log local ---
    $logContent  = "==========================================\r\n";
    $logContent .= "[" . date('Y-m-d H:i:s') . "] PARA: {$to}\r\n";
    $logContent .= "ASUNTO: {$subject}\r\n";
    $logContent .= "MENSAJE:\r\n{$body}\r\n";
    $logContent .= "==========================================\r\n\r\n";
    file_put_contents(MAIL_LOG_PATH, $logContent, FILE_APPEND | LOCK_EX);

    // --- Si no hay credenciales reales, simular éxito (modo desarrollo) ---
    if (MAIL_FROM === 'tu_correo@gmail.com' || MAIL_PASSWORD === 'tu_clave_de_aplicacion') {
        error_log("mail_helper: modo simulación — correo guardado en mail_log.txt para {$to}");
        return true;
    }

    // --- Intentar PHPMailer + SMTP ---
    if ($_phpmailerAvailable) {
        try {
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = MAIL_FROM;
            $mail->Password   = MAIL_PASSWORD;
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            $mail->CharSet    = 'UTF-8';
            $mail->Timeout    = 10;

            $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
            $mail->addAddress($to);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $body;
            $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $body));

            $mail->send();
            error_log("mail_helper: correo enviado via SMTP a {$to}");
            return true;

        } catch (\Exception $e) {
            $error = "SMTP error: " . $e->getMessage();
            file_put_contents(MAIL_LOG_PATH, "ERROR SMTP: {$error}\r\n", FILE_APPEND | LOCK_EX);
            error_log("mail_helper SMTP falló: {$error}");
            // Caer a mail() nativo
        }
    }

    // --- Fallback: mail() nativo de PHP ---
    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM . ">\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    $sent = @mail($to, $subject, $body, $headers);
    if ($sent) {
        error_log("mail_helper: correo enviado via mail() nativo a {$to}");
    } else {
        $error = "mail() nativo falló para {$to}";
        file_put_contents(MAIL_LOG_PATH, "ERROR mail(): {$error}\r\n", FILE_APPEND | LOCK_EX);
        error_log("mail_helper: {$error}");
    }
    return $sent;
}

// ============================================================
// FUNCIÓN: build_approval_email()
// Construye el HTML del correo de APROBACIÓN
// ============================================================
/**
 * @param array $reserva  Fila de BD con: nombre, espacio, fecha, hora_inicio, hora_fin
 * @return string HTML del correo
 */
function build_approval_email(array $reserva): string
{
    $nombre     = htmlspecialchars($reserva['nombre']      ?? 'Usuario');
    $espacio    = htmlspecialchars($reserva['espacio']     ?? '');
    $fecha      = htmlspecialchars($reserva['fecha']       ?? '');
    $horaInicio = htmlspecialchars(substr($reserva['hora_inicio'] ?? '', 0, 5));
    $horaFin    = htmlspecialchars(substr($reserva['hora_fin']    ?? '', 0, 5));

    // Formatear fecha legible
    $fechaLegible = $fecha;
    if ($fecha) {
        try {
            $dt = new DateTime($fecha);
            $fechaLegible = $dt->format('d/m/Y');
        } catch (Exception $e) { /* usar fecha cruda */ }
    }

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
    .header h1 { margin: 0; font-size: 22px; }
    .badge { display: inline-block; background: #28a745; color: #fff;
             border-radius: 20px; padding: 6px 18px; font-size: 15px;
             font-weight: bold; margin: 16px 0; }
    .detail { background: #f0f4ff; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    .detail p { margin: 8px 0; font-size: 15px; color: #333; }
    .detail strong { color: #1a237e; }
    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 24px; }
    .note { background: #fff8e1; border-left: 4px solid #ffc107;
            padding: 10px 14px; border-radius: 4px; font-size: 13px; color: #555; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🏛️ Sistema de Reservas Poligran</h1>
    </div>
    <div style="padding: 24px;">
      <p>Hola, <strong>{$nombre}</strong></p>
      <p>Nos complace informarte que tu solicitud de reserva ha sido:</p>
      <div style="text-align:center;">
        <span class="badge">✅ APROBADA</span>
      </div>
      <div class="detail">
        <p>📍 <strong>Espacio:</strong> Auditorio {$espacio}</p>
        <p>📅 <strong>Fecha:</strong> {$fechaLegible}</p>
        <p>🕐 <strong>Hora:</strong> {$horaInicio} – {$horaFin}</p>
      </div>
      <div class="note">
        ⚠️ Recuerda presentarte con tu identificación <strong>5 minutos antes</strong>
        del inicio de tu reserva.
      </div>
      <p style="margin-top:20px; color:#555; font-size:14px;">
        Si tienes alguna pregunta, comunícate con la administración.
      </p>
    </div>
    <div class="footer">
      Sistema de Reservas Poligran &mdash; Correo automático, no responder.
    </div>
  </div>
</body>
</html>
HTML;
}

// ============================================================
// FUNCIÓN: build_rejection_email()
// Construye el HTML del correo de RECHAZO
// ============================================================
/**
 * @param array $reserva  Fila de BD con: nombre, espacio, fecha, hora_inicio, hora_fin
 * @return string HTML del correo
 */
function build_rejection_email(array $reserva): string
{
    $nombre     = htmlspecialchars($reserva['nombre']      ?? 'Usuario');
    $espacio    = htmlspecialchars($reserva['espacio']     ?? '');
    $fecha      = htmlspecialchars($reserva['fecha']       ?? '');
    $horaInicio = htmlspecialchars(substr($reserva['hora_inicio'] ?? '', 0, 5));
    $horaFin    = htmlspecialchars(substr($reserva['hora_fin']    ?? '', 0, 5));

    $fechaLegible = $fecha;
    if ($fecha) {
        try {
            $dt = new DateTime($fecha);
            $fechaLegible = $dt->format('d/m/Y');
        } catch (Exception $e) { /* usar fecha cruda */ }
    }

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
    .header h1 { margin: 0; font-size: 22px; }
    .badge { display: inline-block; background: #dc3545; color: #fff;
             border-radius: 20px; padding: 6px 18px; font-size: 15px;
             font-weight: bold; margin: 16px 0; }
    .detail { background: #f0f4ff; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    .detail p { margin: 8px 0; font-size: 15px; color: #333; }
    .detail strong { color: #1a237e; }
    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🏛️ Sistema de Reservas Poligran</h1>
    </div>
    <div style="padding: 24px;">
      <p>Hola, <strong>{$nombre}</strong></p>
      <p>Lamentamos informarte que tu solicitud de reserva ha sido:</p>
      <div style="text-align:center;">
        <span class="badge">❌ RECHAZADA</span>
      </div>
      <div class="detail">
        <p>📍 <strong>Espacio:</strong> Auditorio {$espacio}</p>
        <p>📅 <strong>Fecha:</strong> {$fechaLegible}</p>
        <p>🕐 <strong>Hora:</strong> {$horaInicio} – {$horaFin}</p>
      </div>
      <p style="color:#555; font-size:14px;">
        Puedes intentar reservar en otro horario o comunicarte con la administración
        para más información.
      </p>
    </div>
    <div class="footer">
      Sistema de Reservas Poligran &mdash; Correo automático, no responder.
    </div>
  </div>
</body>
</html>
HTML;
}
