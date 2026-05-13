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
                <button class="menu-item active" data-view="inicio">Inicio</button>
                <?php if ($user['rol'] !== 'practicante'): ?>
                <button class="menu-item" data-view="mis-reservas">Mis reservas</button>
                <button class="menu-item" data-view="nueva-reserva">Nueva reserva</button>
                <?php endif; ?>
                <button class="menu-item" data-view="disponibilidad">Ver disponibilidad</button>

                <?php if ($user['rol'] === 'administrativo'): ?>
                <button class="menu-item admin-view" data-view="admin-reservas">Gestión de reservas</button>
                <button class="menu-item admin-view" data-view="admin-usuarios">Usuarios</button>
                <button class="menu-item admin-view" data-view="admin-recursos">Recursos</button>
                <button class="menu-item admin-view" data-view="admin-dias">Días bloqueados</button>
                <button class="menu-item admin-view" data-view="admin-codigos">🔑 Códigos de invitación</button>
                <?php endif; ?>
                <?php if ($user['rol'] === 'coordinador'): ?>
                <button class="menu-item" data-view="coordinador-dashboard">📊 Dashboard avanzado</button>
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
            <!-- ── VISTA: INICIO ───────────────────────────────────── -->
            <section id="view-inicio" class="view active">

                <!-- Banner de bienvenida mejorado -->
                <div class="welcome-banner">
                    <div>
                        <h2>Bienvenido, <?php echo htmlspecialchars($user['nombre']); ?> 👋</h2>
                        <p>Panel de gestión de auditorios · Politécnico Grancolombiano</p>
                    </div>
                    <span class="welcome-badge"><?php echo htmlspecialchars($user['rol']); ?></span>
                </div>

                <!-- Stats del usuario -->
                <h3 style="font-size:0.85rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;font-weight:600;">Mis reservas</h3>
                <div class="stats-grid" id="mis-stats-grid">
                    <div class="stat-card stat-total">
                        <span class="stat-num" id="stat-total">—</span>
                        <span class="stat-label">Total reservas</span>
                    </div>
                    <div class="stat-card stat-pendiente">
                        <span class="stat-num" id="stat-pendientes">—</span>
                        <span class="stat-label">Pendientes</span>
                    </div>
                    <div class="stat-card stat-aprobada">
                        <span class="stat-num" id="stat-aprobadas">—</span>
                        <span class="stat-label">Aprobadas</span>
                    </div>
                    <div class="stat-card stat-rechazada">
                        <span class="stat-num" id="stat-rechazadas">—</span>
                        <span class="stat-label">Rechazadas</span>
                    </div>
                </div>

                <!-- Próxima reserva -->
                <div id="proxima-reserva-card" class="proxima-card" style="display:none;">
                    <p class="proxima-title">📅 Próxima reserva aprobada</p>
                    <div class="proxima-body" id="proxima-body"></div>
                </div>

                <!-- Stats del sistema (solo admin) -->
                <?php if ($user['rol'] === 'administrativo'): ?>
                <h3 style="font-size:0.85rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:24px 0 12px;font-weight:600;">Estado del sistema</h3>
                <div class="stats-grid" id="sistema-stats-grid">
                    <div class="stat-card stat-total">
                        <span class="stat-num" id="sys-total">—</span>
                        <span class="stat-label">Total reservas</span>
                    </div>
                    <div class="stat-card stat-pendiente">
                        <span class="stat-num" id="sys-pendientes">—</span>
                        <span class="stat-label">Pendientes aprobación</span>
                    </div>
                    <div class="stat-card stat-aprobada">
                        <span class="stat-num" id="sys-aprobadas">—</span>
                        <span class="stat-label">Aprobadas</span>
                    </div>
                    <div class="stat-card stat-hoy">
                        <span class="stat-num" id="sys-hoy">—</span>
                        <span class="stat-label">Reservas hoy</span>
                    </div>
                </div>
                <div class="espacios-grid" id="espacios-grid"></div>
                <?php endif; ?>
            </section>

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

<label>Notas adicionales (opcional)</label>
                        <textarea name="requisitos_adicionales" rows="2" placeholder="Indicaciones especiales..."></textarea>

                        <div id="recursos-seccion" style="display:none;">
                            <label style="margin-top:6px;">Recursos a solicitar</label>
                            <div id="recursos-lista" class="recursos-check-list"></div>
                        </div>

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
                    <span class="badge blocked">Gris: bloqueado por dependencia B1/B2/B3</span>
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
                        <div class="password-wrapper">
                            <input type="password" id="current-password" placeholder="Contraseña actual" required>
                            <span class="toggle-password" data-target="current-password">👁️</span>
                        </div>
                        <div class="password-wrapper">
                            <input type="password" id="new-password" placeholder="Nueva contraseña" required>
                            <span class="toggle-password" data-target="new-password">👁️</span>
                        </div>
                        <div class="password-wrapper">
                            <input type="password" id="confirm-password" placeholder="Confirmar nueva contraseña" required>
                            <span class="toggle-password" data-target="confirm-password">👁️</span>
                        </div>
                        <button type="submit" class="primary-btn">Cambiar contraseña</button>
                    </form>
                    <p id="password-msg" class="form-msg"></p>
                </div>
            </section>

            <?php if ($user['rol'] === 'coordinador'): ?>
            <!-- ── VISTA: DASHBOARD COORDINADOR ──────────────────────── -->
            <section id="view-coordinador-dashboard" class="view">
                <h1>Dashboard avanzado</h1>
                <div class="coord-dashboard">
                    <!-- KPIs -->
                    <div class="coord-kpis">
                        <div class="coord-kpi kpi-blue">
                            <span class="coord-kpi-icon">📋</span>
                            <span class="coord-kpi-val" id="ck-total">—</span>
                            <span class="coord-kpi-lbl">Total reservas</span>
                        </div>
                        <div class="coord-kpi kpi-green">
                            <span class="coord-kpi-icon">✅</span>
                            <span class="coord-kpi-val" id="ck-tasa">—</span>
                            <span class="coord-kpi-lbl">Tasa de aprobación</span>
                        </div>
                        <div class="coord-kpi kpi-orange">
                            <span class="coord-kpi-icon">🏆</span>
                            <span class="coord-kpi-val" id="ck-espacio">—</span>
                            <span class="coord-kpi-lbl">Espacio más usado</span>
                        </div>
                        <div class="coord-kpi kpi-purple">
                            <span class="coord-kpi-icon">⏰</span>
                            <span class="coord-kpi-val" id="ck-hora-pico">—</span>
                            <span class="coord-kpi-lbl">Hora pico</span>
                        </div>
                        <div class="coord-kpi kpi-pink">
                            <span class="coord-kpi-icon">⭐</span>
                            <span class="coord-kpi-val" id="ck-calificacion">—</span>
                            <span class="coord-kpi-lbl">Calificación promedio</span>
                        </div>
                    </div>

                    <!-- Gráficas fila 1 -->
                    <div class="coord-charts-row">
                        <div class="coord-chart-card">
                            <h3>Reservas por espacio</h3>
                            <canvas id="chart-por-espacio"></canvas>
                        </div>
                        <div class="coord-chart-card">
                            <h3>Reservas por día de semana</h3>
                            <canvas id="chart-por-dia"></canvas>
                        </div>
                    </div>

                    <!-- Gráfica tendencia + por rol -->
                    <div class="coord-charts-row">
                        <div class="coord-chart-card">
                            <h3>Tendencia últimas 8 semanas</h3>
                            <canvas id="chart-tendencia"></canvas>
                        </div>
                        <div class="coord-chart-card">
                            <h3>Reservas por tipo de usuario</h3>
                            <canvas id="chart-por-rol"></canvas>
                        </div>
                    </div>

                    <!-- Heatmap hora × día -->
                    <div class="coord-heatmap-wrap">
                        <h3>Heatmap de ocupación (hora × día de semana)</h3>
                        <div id="coord-heatmap"></div>
                    </div>

                    <!-- Herramientas de decisión -->
                    <div class="coord-decision-card">
                        <h3>🧠 Herramientas de decisión</h3>
                        <div class="decision-items" id="coord-decisions"></div>
                    </div>
                </div>
            </section>
            <?php endif; ?>

            <?php if ($user['rol'] === 'administrativo'): ?>

            <section id="view-admin-dias" class="view">
                <div class="crud-header">
                    <h1>Días bloqueados</h1>
                </div>
                <p class="section-desc">Bloquea fechas específicas en las que no se podrán hacer reservas (además de martes y jueves que siempre están bloqueados).</p>

                <div class="form-card" style="max-width:480px;margin-bottom:20px;">
                    <div class="crud-form-grid" style="grid-template-columns:1fr 1fr;">
                        <div class="field-group">
                            <label>Fecha a bloquear</label>
                            <input type="date" id="dia-fecha" min="<?php echo date('Y-m-d'); ?>">
                        </div>
                        <div class="field-group">
                            <label>Motivo (opcional)</label>
                            <input type="text" id="dia-motivo" placeholder="Ej: Mantenimiento">
                        </div>
                    </div>
                    <p id="dias-form-msg" class="form-msg" style="margin-top:8px;"></p>
                    <button class="primary-btn" id="btn-bloquear-dia" style="margin-top:12px;">Bloquear día</button>
                </div>

                <p id="admin-dias-msg" class="form-msg"></p>
                <div class="table-wrapper">
                    <table class="crud-table">
                        <thead><tr><th>Fecha</th><th>Día</th><th>Motivo</th><th>Acción</th></tr></thead>
                        <tbody id="admin-dias-tbody">
                            <tr><td colspan="4" class="table-empty">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section id="view-admin-reservas" class="view">
                <div class="crud-header">
                    <h1>Gestión de reservas</h1>
                    <span id="admin-reservas-count" class="table-count"></span>
                </div>

                <div class="filter-bar filter-bar--admin">
                    <div class="filter-group">
                        <label>Estado</label>
                        <select id="filtro-estado">
                            <option value="">Todos</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Aprobada">Aprobada</option>
                            <option value="Rechazada">Rechazada</option>
                            <option value="Cancelada">Cancelada</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Espacio</label>
                        <select id="filtro-espacio">
                            <option value="">Todos</option>
                            <option value="B1">B1</option>
                            <option value="B2">B2</option>
                            <option value="B3">B3</option>
                        </select>
                    </div>
                    <button class="primary-btn" id="btn-filtrar-reservas" style="align-self:flex-end;">Filtrar</button>
                </div>

                <p id="admin-reservas-msg" class="form-msg"></p>

                <div class="table-wrapper">
                    <table class="crud-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Usuario</th>
                                <th>Espacio</th>
                                <th>Fecha</th>
                                <th>Horario</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="admin-reservas-tbody">
                            <tr><td colspan="7" class="table-empty">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section id="view-admin-usuarios" class="view">
                <div class="crud-header">
                    <h1>Gestión de usuarios</h1>
                    <button class="primary-btn" id="btn-nuevo-usuario">+ Nuevo usuario</button>
                </div>
                <p id="admin-usuarios-msg" class="form-msg"></p>
                <div class="table-wrapper">
                    <table class="crud-table" id="admin-usuarios-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Creado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="admin-usuarios-tbody">
                            <tr><td colspan="6" class="table-empty">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section id="view-admin-codigos" class="view">
                <div class="crud-header">
                    <h1>Códigos de invitación</h1>
                    <button class="primary-btn" id="btn-nuevo-codigo">+ Nuevo código</button>
                </div>
                <p class="section-desc">Los nuevos usuarios necesitan un código para registrarse. Crea códigos con usos limitados y rol específico si lo necesitas.</p>
                <p id="admin-codigos-msg" class="form-msg"></p>

                <!-- Formulario crear código -->
                <div class="form-card codigo-form-card" id="codigo-form-card" style="display:none;">
                    <div class="crud-form-grid" style="grid-template-columns:1fr 1fr 1fr;">
                        <div class="field-group">
                            <label>Código (dejar vacío = auto)</label>
                            <input type="text" id="nuevo-codigo-valor" placeholder="Ej: POLI2025" maxlength="32"
                                   style="text-transform:uppercase;">
                        </div>
                        <div class="field-group">
                            <label>Rol permitido</label>
                            <select id="nuevo-codigo-rol">
                                <option value="">Cualquier rol no privilegiado</option>
                                <option value="docente">Solo Docente</option>
                                <option value="externo">Solo Externo</option>
                                <option value="practicante">Solo Practicante</option>
                            </select>
                        </div>
                        <div class="field-group">
                            <label>Usos máximos</label>
                            <input type="number" id="nuevo-codigo-usos" value="1" min="1" max="1000">
                        </div>
                        <div class="field-group field-group--full">
                            <label>Descripción (opcional)</label>
                            <input type="text" id="nuevo-codigo-desc" placeholder="Ej: Docentes Facultad Ingeniería" maxlength="200">
                        </div>
                    </div>
                    <p id="codigo-form-msg" class="form-msg"></p>
                    <div style="display:flex;gap:10px;margin-top:12px;">
                        <button class="btn-secondary" id="btn-cancelar-codigo">Cancelar</button>
                        <button class="primary-btn" id="btn-guardar-codigo">Crear código</button>
                    </div>
                </div>

                <div class="table-wrapper" style="margin-top:16px;">
                    <table class="crud-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Rol</th>
                                <th>Usos</th>
                                <th>Estado</th>
                                <th>Creado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="admin-codigos-tbody">
                            <tr><td colspan="7" class="table-empty">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section id="view-admin-recursos" class="view">
                <div class="crud-header">
                    <h1>Gestión de recursos</h1>
                    <button class="primary-btn" id="btn-nuevo-recurso">+ Nuevo recurso</button>
                </div>
                <p id="admin-recursos-msg" class="form-msg"></p>
                <div class="table-wrapper">
                    <table class="crud-table" id="admin-recursos-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nombre</th>
                                <th>Descripción</th>
                                <th>Cantidad</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="admin-recursos-tbody">
                            <tr><td colspan="5" class="table-empty">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
            <?php endif; ?>
        </main>
    </div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
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

<!-- Modal editar reserva (admin) -->
<div id="modal-editar-reserva" class="modal" style="display:none;">
    <div class="modal-content">
        <span class="modal-close" data-modal="modal-editar-reserva">&times;</span>
        <h2>Editar reserva</h2>
        <form id="form-editar-reserva" class="crud-form">
            <input type="hidden" id="er-id">
            <div class="crud-form-grid">
                <div class="field-group">
                    <label>Usuario</label>
                    <input type="text" id="er-usuario" disabled>
                </div>
                <div class="field-group">
                    <label>Espacio</label>
                    <select id="er-espacio" required>
                        <option value="B1">B1 – Capacidad 50</option>
                        <option value="B2">B2 – Capacidad 50</option>
                        <option value="B3">B3 – Capacidad 100</option>
                    </select>
                </div>
                <div class="field-group">
                    <label>Fecha</label>
                    <input type="date" id="er-fecha" required>
                </div>
                <div class="field-group">
                    <label>Estado</label>
                    <select id="er-estado" required>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Aprobada">Aprobada</option>
                        <option value="Rechazada">Rechazada</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                </div>
                <div class="field-group">
                    <label>Hora inicio</label>
                    <input type="time" id="er-hora-inicio" required>
                </div>
                <div class="field-group">
                    <label>Hora fin</label>
                    <input type="time" id="er-hora-fin" required>
                </div>
                <div class="field-group field-group--full">
                    <label>Recursos adicionales</label>
                    <textarea id="er-requisitos" rows="2" placeholder="Proyector, sonido, etc."></textarea>
                </div>
            </div>
            <p id="modal-er-msg" class="form-msg"></p>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" data-modal="modal-editar-reserva">Cancelar</button>
                <button type="submit" class="primary-btn">Guardar cambios</button>
            </div>
        </form>
    </div>
</div>

<!-- Modal CRUD usuarios -->
<div id="modal-usuario" class="modal" style="display:none;">
    <div class="modal-content">
        <span class="modal-close" data-modal="modal-usuario">&times;</span>
        <h2 id="modal-usuario-title">Nuevo usuario</h2>
        <form id="form-usuario" class="crud-form" autocomplete="off">
            <input type="hidden" id="usuario-id">
            <div class="crud-form-grid">
                <div class="field-group">
                    <label>Nombre completo</label>
                    <input type="text" id="usuario-nombre" placeholder="Nombre completo" required>
                </div>
                <div class="field-group">
                    <label>Email</label>
                    <input type="email" id="usuario-email" placeholder="correo@ejemplo.com" required>
                </div>
                <div class="field-group">
                    <label>Contraseña <span id="pass-hint" class="field-hint">(mínimo 8 caracteres)</span></label>
                    <input type="password" id="usuario-password" placeholder="Contraseña" autocomplete="new-password">
                </div>
                <div class="field-group">
                    <label>Rol</label>
                    <select id="usuario-rol" required>
                        <option value="" disabled selected>Selecciona rol</option>
                        <option value="administrativo">Administrativo</option>
                        <option value="coordinador">Coordinador</option>
                        <option value="docente">Docente</option>
                        <option value="externo">Externo</option>
                        <option value="practicante">Practicante</option>
                    </select>
                </div>
            </div>
            <p id="modal-usuario-msg" class="form-msg"></p>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" data-modal="modal-usuario">Cancelar</button>
                <button type="submit" class="primary-btn">Guardar</button>
            </div>
        </form>
    </div>
</div>

<!-- Modal CRUD recursos -->
<div id="modal-recurso" class="modal" style="display:none;">
    <div class="modal-content">
        <span class="modal-close" data-modal="modal-recurso">&times;</span>
        <h2 id="modal-recurso-title">Nuevo recurso</h2>
        <form id="form-recurso" class="crud-form">
            <input type="hidden" id="recurso-id">
            <div class="crud-form-grid">
                <div class="field-group">
                    <label>Nombre</label>
                    <input type="text" id="recurso-nombre" placeholder="Ej: Proyector" required>
                </div>
                <div class="field-group">
                    <label>Cantidad</label>
                    <input type="number" id="recurso-cantidad" placeholder="0" min="0" required>
                </div>
                <div class="field-group field-group--full">
                    <label>Descripción</label>
                    <textarea id="recurso-descripcion" rows="3" placeholder="Descripción del recurso..."></textarea>
                </div>
            </div>
            <p id="modal-recurso-msg" class="form-msg"></p>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" data-modal="modal-recurso">Cancelar</button>
                <button type="submit" class="primary-btn">Guardar</button>
            </div>
        </form>
    </div>
</div>
</body>
</html>
