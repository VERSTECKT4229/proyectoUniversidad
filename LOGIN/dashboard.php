<?php
require_once 'session.php';
require_auth();

$user = $_SESSION['user'];
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard - Reservas Poli de Auditorios</title>
    <link rel="stylesheet" href="Style.css">
</head>
<body class="dashboard-body" data-user-role="<?php echo $user['rol']; ?>">
    <div class="dashboard-layout">
        <aside class="sidebar">
            <div class="brand-box">
                <img src="assets/img/logo-institucional.png" alt="Logo institucional" class="brand-logo" onerror="this.style.display='none'">
<h2>Reservas Poli</h2>
            </div>
            <p class="welcome">Hola, <?php echo htmlspecialchars($user['nombre']); ?></p>

<nav class="menu">
                <?php if ($user['rol'] !== 'practicante'): ?>
                <button class="menu-item active" data-view="mis-reservas">Mis reservas</button>
                <button class="menu-item" data-view="nueva-reserva">Nueva reserva</button>
                <?php endif; ?>
                <button class="menu-item <?php echo ($user['rol'] === 'practicante') ? 'active' : ''; ?>" data-view="disponibilidad">Ver disponibilidad</button>

<?php if (in_array($user['rol'], ['administrador', 'administrativo'])): ?>
                <button class="menu-item admin-view" data-view="admin-reservas">Reservas pendientes</button>
                <?php endif; ?>
                <div class="menu-dropdown">
                    <button class="menu-item dropdown-toggle" type="button">Opciones</button>
                    <div class="dropdown-content">
                        <button class="menu-item submenu-item" data-view="perfil">Mi perfil</button>
                        <button class="menu-item submenu-item" data-view="password">Cambiar contraseña</button>
<a class="menu-item submenu-item logout-link" href="api/logout.php" onclick="return confirm('¿Estás seguro que quieres cerrar sesión?')">Cerrar sesión</a>
                    </div>
                </div>
            </nav>
        </aside>

        <main class="main-content">
            <div id="runtime-links-banner" class="runtime-banner runtime-banner-dashboard">
                <strong>Links activos:</strong>
                <span id="runtime-local">Local: -</span>
                <span id="runtime-public">Cloudflare: -</span>
            </div>
<?php if ($user['rol'] !== 'practicante'): ?>
            <section id="view-mis-reservas" class="view active">
                <h1 class="section-header">
                    Mis reservas
                    <div class="calendar-nav">
                        <button id="prev-week" class="week-btn">← Anterior</button>
                        <button id="today-week" class="week-btn week-btn-today">Hoy</button>
                        <button id="next-week" class="week-btn">Siguiente →</button>
                    </div>
                </h1>
                <div id="mis-reservas-calendar" class="calendar-grid"></div>
                <div id="mis-reservas-list" class="card-list"></div>
            </section>

            <section id="view-nueva-reserva" class="view">
                <h1>
                    Nueva reserva
<button id="btn-calificar-servicio" class="rate-btn">★ Calificar Servicio</button>
                </h1>
                <div class="form-card centered">
                    <form id="nueva-reserva-form">
                        <label>Fecha</label>
                        <input type="date" name="fecha" required>

                        <label>Hora inicio</label>
                        <input type="time" name="hora_inicio" required>

                        <label>Hora fin</label>
                        <input type="time" name="hora_fin" required>

                        <label>Espacio</label>
                        <select name="espacio" required>
                            <option value="">Seleccione</option>
<option value="B1">B1 - Capacidad (50)</option>
                            <option value="B2">B2 - Capacidad (50)</option>
                            <option value="B3">B3 - Capacidad (100)</option>
                        </select>

<label>Recursos adicionales (opcional)</label>
                        <textarea name="requisitos_adicionales" rows="4" placeholder="Proyector, sonido, etc."></textarea>

                        <button type="submit" class="primary-btn">Finalizar reserva</button>
                    </form>
                    <p id="nueva-reserva-msg" class="form-msg"></p>
                </div>
            </section>
            <?php endif; ?>

            <section id="view-disponibilidad" class="view">
                <h1>Disponibilidad general</h1>
                <div class="disp-filter-bar">
                    <label for="disp-date-filter"><strong>Fecha:</strong></label>
                    <input type="date" id="disp-date-filter"
                           value="<?php echo date('Y-m-d'); ?>"
                           min="<?php echo date('Y-m-d'); ?>">
                    <button id="disp-ver-btn" class="primary-btn" style="padding:8px 18px;">Ver disponibilidad</button>
                </div>
                <p class="legend">
                    <span class="badge available">Verde: disponible</span>
                    <span class="badge occupied">Rojo: ocupado</span>
                </p>
                <div id="disponibilidad-calendar" class="calendar-grid"></div>
            </section>

<section id="view-perfil" class="view">
                <h1>Mi perfil</h1>
                <div class="info-card">
                    <p><strong>Nombre:</strong> <?php echo htmlspecialchars($user['nombre']); ?></p>
                    <p><strong>Email:</strong> <?php echo htmlspecialchars($user['email']); ?></p>
                    <p><strong>Rol:</strong> <?php echo htmlspecialchars($user['rol']); ?></p>
                </div>
                <h2 style="margin-top:20px;">Historial de reservas</h2>
<div class="filter-bar">
                    <label for="historial-filtro">Filtrar por estado:</label>
                    <select id="historial-filtro">
                        <option value="todas">Todas</option>
                        <option value="Aprobada">Aprobadas</option>
                        <option value="Rechazada">Rechazadas</option>
                        <option value="Pendiente">Pendientes</option>
                    </select>
                </div>
                <div id="perfil-historial" class="card-list"></div>
            </section>

            <section id="view-password" class="view">
                <h1>Cambiar contraseña</h1>
                <div class="form-card centered">
                    <form id="cambiar-password-form">
                        <input type="password" id="current-password" placeholder="Contraseña actual" required>
                        <input type="password" id="new-password" placeholder="Nueva contraseña" required>
                        <input type="password" id="confirm-password" placeholder="Confirmar nueva contraseña" required>
                        <button type="submit" class="primary-btn">Cambiar contraseña</button>
                    </form>
                    <p id="password-msg" class="form-msg"></p>
                </div>
            </section>

            <?php if (in_array($user['rol'], ['administrador', 'administrativo'])): ?>
            <section id="view-admin-reservas" class="view">
                <h1>Reservas pendientes (Admin)</h1>
                <div id="admin-reservas-list" class="card-list"></div>
            </section>
            <?php endif; ?>
        </main>
    </div>

<script src="js/dashboard.js"></script>
<script src="js/validador-fechas.js"></script>

<!-- Modal para Calificar Servicio -->
<div id="modal-calificar" class="modal" style="display:none;">
    <div class="modal-content">
        <span class="modal-close">&times;</span>
        <h2>⭐ Calificar Servicio</h2>
        <p>Selecciona tu calificación del 1 al 10:</p>
        <div class="rating-buttons">
            <button class="rating-btn" data-value="1">1</button>
            <button class="rating-btn" data-value="2">2</button>
            <button class="rating-btn" data-value="3">3</button>
            <button class="rating-btn" data-value="4">4</button>
            <button class="rating-btn" data-value="5">5</button>
            <button class="rating-btn" data-value="6">6</button>
            <button class="rating-btn" data-value="7">7</button>
            <button class="rating-btn" data-value="8">8</button>
            <button class="rating-btn" data-value="9">9</button>
            <button class="rating-btn" data-value="10">10</button>
        </div>
        <div id="rating-selection" style="margin:15px 0;font-size:18px;text-align:center;font-weight:bold;"></div>
        <label>Comentario (opcional):</label>
        <textarea id="rating-comment" rows="3" placeholder="Escribe tu comentario..."></textarea>
        <button id="btn-enviar-calificacion" class="primary-btn" disabled>Enviar Calificación</button>
        <p id="rating-msg" class="form-msg"></p>
    </div>
</div>

<script src="js/servicio-cliente.js"></script>
</body>
</html>
