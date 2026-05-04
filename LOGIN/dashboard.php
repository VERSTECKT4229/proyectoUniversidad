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
    <title>Dashboard - Reservas de Auditorios</title>
    <link rel="stylesheet" href="Style.css">
</head>
<body class="dashboard-body">
    <div class="dashboard-layout">
        <aside class="sidebar">
            <div class="brand-box">
                <img src="assets/img/logo-institucional.png" alt="Logo institucional" class="brand-logo" onerror="this.style.display='none'">
                <h2>Reservas</h2>
            </div>
            <p class="welcome">Hola, <?php echo htmlspecialchars($user['nombre']); ?></p>

            <nav class="menu">
                <button class="menu-item active" data-view="mis-reservas">Mis reservas</button>
                <button class="menu-item" data-view="nueva-reserva">Nueva reserva</button>
                <button class="menu-item" data-view="disponibilidad">Ver disponibilidad</button>

<?php if (in_array($user['rol'], ['administrador', 'administrativo'])): ?>
                <button class="menu-item admin-view" data-view="admin-reservas">Reservas pendientes</button>
                <?php endif; ?>
                <div class="menu-dropdown">
                    <button class="menu-item dropdown-toggle" type="button">Opciones</button>
                    <div class="dropdown-content">
                        <button class="menu-item submenu-item" data-view="perfil">Mi perfil</button>
                        <button class="menu-item submenu-item" data-view="password">Cambiar contraseña</button>
                        <a class="menu-item submenu-item logout-link" href="api/logout.php">Cerrar sesión</a>
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
            <section id="view-mis-reservas" class="view active">
                <h1>Mis reservas</h1>
                <div class="calendar-nav">
                    <button id="prev-week" class="secondary-btn">← Semana anterior</button>
                    <button id="next-week" class="secondary-btn">Semana siguiente →</button>
                    <button id="today-week" class="secondary-btn">Hoy</button>
                </div>
                <div id="mis-reservas-calendar" class="calendar-grid"></div>
                <div id="mis-reservas-list" class="card-list"></div>
            </section>

            <section id="view-nueva-reserva" class="view">
                <h1>Nueva reserva</h1>
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
                            <option value="B1">B1</option>
                            <option value="B2">B2</option>
                            <option value="B3">B3</option>
                        </select>

                        <label>Requisitos adicionales (opcional)</label>
                        <textarea name="requisitos_adicionales" rows="4" placeholder="Proyector, sonido, etc."></textarea>

                        <button type="submit" class="primary-btn">Finalizar reserva</button>
                    </form>
                    <p id="nueva-reserva-msg" class="form-msg"></p>
                </div>
            </section>

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
</body>
</html>
