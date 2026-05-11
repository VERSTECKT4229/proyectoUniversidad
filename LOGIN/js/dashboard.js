document.addEventListener('DOMContentLoaded', () => {
    const menuButtons = document.querySelectorAll('.menu-item[data-view]');
    const views = document.querySelectorAll('.view');

    const misReservasCalendar = document.getElementById('mis-reservas-calendar');
    const misReservasList = document.getElementById('mis-reservas-list');
    const disponibilidadCalendar = document.getElementById('disponibilidad-calendar');

    const nuevaReservaForm = document.getElementById('nueva-reserva-form');
    const nuevaReservaMsg = document.getElementById('nueva-reserva-msg');

    // ============================================
    // UTILIDADES DE FECHA (sin desfase UTC)
    // ============================================
    function formatDateLocal(date) {
        const year  = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day   = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Escape HTML para evitar XSS
    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    // Normaliza al lunes de la semana
    function getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    let currentWeekStart = getMonday(new Date());

    function getWeekDates(baseDate = currentWeekStart) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() + i);
            days.push({
                iso: formatDateLocal(d),
                label: d.toLocaleDateString('es-CO', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit'
                })
            });
        }
        return days;
    }

    // ============================================
    // HORAS DEL SISTEMA (07:00 – 20:00)
    // ============================================
    const hours = [];
    for (let h = 7; h <= 20; h++) {
        hours.push(String(h).padStart(2, '0') + ':00');
    }

    // ============================================
    // COMPARACIÓN DE HORAS (en minutos, sin bugs)
    // ============================================
    function toMinutes(time) {
        const [h, m] = String(time).slice(0, 5).split(':').map(Number);
        return h * 60 + (m || 0);
    }

    function overlaps(start, end, targetHour) {
        const startM  = toMinutes(start);
        const endM    = toMinutes(end);
        const targetM = toMinutes(targetHour);
        return targetM >= startM && targetM < endM;
    }

    // ============================================
    // CONSTRUCTOR DE GRILLA
    // ============================================
    function buildGrid(container, columns, rowBuilder) {
        container.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'calendar-table';

        const thead = document.createElement('thead');
        const hr    = document.createElement('tr');
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        hours.forEach(hour => {
            const tr = rowBuilder(hour);
            if (tr) tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        container.appendChild(table);
    }

    // ============================================
    // FORMATO DE FECHA LEGIBLE
    // ============================================
    function formatReservationDate(dateStr) {
        if (!dateStr) return 'Sin fecha';
        try {
            const datePart = String(dateStr).split(' ')[0].split('T')[0];
            const [year, month, day] = datePart.split('-');
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateStr;
        }
    }

    // ============================================
    // RUNTIME LINKS BANNER
    // ============================================
    async function loadRuntimeLinks() {
        try {
            const res  = await fetch('api/runtime_links.php');
            const data = await res.json();
            if (!data.success) return;
            const localEl  = document.getElementById('runtime-local');
            const publicEl = document.getElementById('runtime-public');
            if (localEl)  localEl.textContent  = 'Local: '      + (data.local_base  || '-');
            if (publicEl) publicEl.textContent  = 'Cloudflare: ' + (data.public_base || '-');
        } catch (e) { /* ignora */ }
    }

    // ============================================
    // MIS RESERVAS
    // ============================================
    async function loadMisReservas() {
        try {
            const res  = await fetch('api/mis_reservas.php');
            const data = await res.json();

            if (!data.success) {
                if (misReservasList) misReservasList.innerHTML =
                    `<p class="error-text">${data.message || 'No se pudo cargar.'}</p>`;
                return;
            }

            const reservas = data.reservas || [];

            // --- Grilla semanal ---
            const weekDates = getWeekDates();

            if (misReservasCalendar) {
                buildGrid(
                    misReservasCalendar,
                    ['Hora', ...weekDates.map(d => d.label)],
                    (hour) => {
                        const tr = document.createElement('tr');

                        const hourTd = document.createElement('td');
                        hourTd.textContent = hour;
                        hourTd.className   = 'hour-col';
                        tr.appendChild(hourTd);

                        weekDates.forEach(day => {
                            const td    = document.createElement('td');
                            const match = reservas.find(r =>
                                r.fecha === day.iso &&
                                overlaps(r.hora_inicio, r.hora_fin, hour)
                            );

                            if (match) {
                                td.className = 'slot occupied';
                                td.innerHTML = `
                                    <strong>${match.espacio}</strong><br>
                                    ${match.hora_inicio.slice(0,5)}-${match.hora_fin.slice(0,5)}<br>
                                    <span class="estado-${match.estado.toLowerCase()}">${match.estado}</span>
                                `;
                            } else {
                                td.className  = 'slot available';
                                td.textContent = 'Disponible';
                            }
                            tr.appendChild(td);
                        });
                        return tr;
                    }
                );
            }

            // --- Lista de tarjetas ---
            if (!misReservasList) return;

            if (reservas.length === 0) {
                misReservasList.innerHTML = '<p>No tienes reservas registradas.</p>';
                return;
            }

misReservasList.innerHTML = reservas.map(r => `
                <div class="reservation-card">
                    <p><strong>Espacio:</strong> ${escapeHtml(r.espacio)}</p>
                    <p><strong>Fecha:</strong> ${formatReservationDate(r.fecha)}</p>
                    <p><strong>Hora:</strong> ${r.hora_inicio.slice(0,5)} - ${r.hora_fin.slice(0,5)}</p>
                    <p><strong>Estado:</strong>
                        <span class="estado-${r.estado.toLowerCase()}">${escapeHtml(r.estado)}</span>
                    </p>
                    ${r.requisitos ? `<button class="view-recursos-btn" data-id="${r.id}">Ver Recursos</button>
                    <div id="recursos-${r.id}" class="recursos-detalles" style="display:none;">
                        <p><strong>Recursos:</strong> ${escapeHtml(r.requisitos)}</p>
                    </div>` : ''}
                    ${r.estado === 'Pendiente' ? `<button class="cancel-reserva-btn" data-id="${r.id}">Cancelar reserva</button>` : ''}
                </div>
            `).join('');

// Botones de cancelar con closure (evita lectura tardía del DOM)
            misReservasList.querySelectorAll('.cancel-reserva-btn').forEach(btn => {
                const reservaId = parseInt(btn.getAttribute('data-id'), 10);
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Cancelar esta reserva?')) return;
                    try {
                        const res = await fetch('api/cancelar_reserva.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id_reserva: reservaId })
                        });
                        const data = await res.json();
                        if (data.success) {
                            loadMisReservas();
                        } else {
                            alert('❌ ' + (data.message || 'No se pudo cancelar'));
                        }
                    } catch (err) {
                        alert('❌ Error de conexión al cancelar');
                    }
                });
            });

            // Botones de Ver Recursos (toggle mostrar/ocultar)
            misReservasList.querySelectorAll('.view-recursos-btn').forEach(btn => {
                const reservaId = btn.getAttribute('data-id');
                btn.addEventListener('click', () => {
                    const detalles = document.getElementById('recursos-' + reservaId);
                    if (detalles) {
                        if (detalles.style.display === 'none') {
                            detalles.style.display = 'block';
                            btn.textContent = 'Ocultar Recursos';
                        } else {
                            detalles.style.display = 'none';
                            btn.textContent = 'Ver Recursos';
                        }
                    }
                });
            });

        } catch (err) {
            console.error('Error loadMisReservas:', err);
            if (misReservasList) misReservasList.innerHTML =
                '<p class="error-text">Error de conexión al cargar reservas.</p>';
        }
    }

    // ============================================
    // DISPONIBILIDAD (con navegación por día)
    // ============================================
    let currentDate = new Date();

    // Exponer para botones HTML
    // Navegación automática: Flechas
    window.changeDay = function(offset) {
        currentDate.setDate(currentDate.getDate() + offset);
        loadDisponibilidad();
    };

    // Sincronización de estado desde el Input
    function syncStateFromInput() {
        const dateInput = document.getElementById('disp-date-filter');
        if (dateInput && dateInput.value) {
            const [y, m, d] = dateInput.value.split('-').map(Number);
            currentDate = new Date(y, m - 1, d, 12, 0, 0);
        }
    }

    async function loadDisponibilidad() {
        if (!disponibilidadCalendar) return;

        const dateInput = document.getElementById('disp-date-filter');
        const fecha = formatDateLocal(currentDate);

        // Actualizar Interfaz (Input y Etiqueta)
        if (dateInput) dateInput.value = fecha;
        const label = document.getElementById('disp-current-date');
        if (label) label.textContent = fecha;

        try {
            // Fetch automático con fecha actualizada y prevención de caché
            const res  = await fetch(`api/disponibilidad.php?fecha=${fecha}&_=${Date.now()}`);
            const data = await res.json();
            

            if (!data.success) {
                disponibilidadCalendar.innerHTML =
                    `<p class="error-text">${data.message || 'No disponible'}</p>`;
                return;
            }

            const reservas = data.reservas || [];
            const espacios = ['B1', 'B2', 'B3'];

            buildGrid(
                disponibilidadCalendar,
                ['Hora', ...espacios],
                (hour) => {
                    const tr = document.createElement('tr');

                    const hourTd = document.createElement('td');
                    hourTd.className   = 'hour-col';
                    hourTd.textContent = hour;
                    tr.appendChild(hourTd);

                    espacios.forEach(espacio => {
                        const td    = document.createElement('td');
                        const match = reservas.some(r => r.espacio === espacio && overlaps(r.hora_inicio, r.hora_fin, hour));

                        if (match) {
                            td.className   = 'slot occupied';
                            td.textContent = 'Ocupado';
                        } else {
                            td.className   = 'slot available';
                            td.textContent = 'Disponible';
                        }
                        tr.appendChild(td);
                    });

                    return tr;
                }
            );

        } catch (err) {
            console.error('Error loadDisponibilidad:', err);
            disponibilidadCalendar.innerHTML =
                '<p class="error-text">Error de conexión al cargar disponibilidad.</p>';
        }
    }

    // ============================================
    // ADMIN: RESERVAS PENDIENTES
    // ============================================
    async function loadAdminReservas() {
        const adminReservasList = document.getElementById('admin-reservas-list');
        if (!adminReservasList) return;

        try {
            const res  = await fetch('api/admin_reservas_pendientes.php');
            const data = await res.json();

            if (!data.success) {
                adminReservasList.innerHTML =
                    `<p class="error-text">${data.message || 'Error al cargar.'}</p>`;
                return;
            }

            if (!data.pendientes || data.pendientes.length === 0) {
                adminReservasList.innerHTML = '<p>No hay reservas pendientes.</p>';
                return;
            }

            adminReservasList.innerHTML = data.pendientes.map(reserva => `
                <div class="reservation-card admin-reserva">
                    <div class="admin-card-header">
                        <span class="admin-card-espacio">Auditorio ${escapeHtml(reserva.espacio)}</span>
                        <span class="estado-pendiente">Pendiente</span>
                    </div>
                    <div class="admin-card-body">
                        <div class="admin-card-row">
                            <span class="admin-card-label">Usuario</span>
                            <span>${escapeHtml(reserva.usuario)}</span>
                        </div>
                        <div class="admin-card-row">
                            <span class="admin-card-label">Fecha</span>
                            <span>${formatReservationDate(reserva.fecha)}</span>
                        </div>
                        <div class="admin-card-row">
                            <span class="admin-card-label">Horario</span>
                            <span>${reserva.hora_inicio.slice(0,5)} – ${reserva.hora_fin.slice(0,5)}</span>
                        </div>
                        <div class="admin-card-row">
<span class="admin-card-label">Recursos</span>
                            <span>${escapeHtml(reserva.requisitos) || '—'}</span>
                        </div>
                    </div>
                    <div class="admin-card-actions">
                        <button class="admin-btn approve-btn">✔ Aprobar</button>
                        <button class="admin-btn reject-btn">✖ Rechazar</button>
                    </div>
                </div>
            `).join('');

            // Closures: el ID es un número capturado directamente, nunca leído del DOM
            const cards = adminReservasList.querySelectorAll('.reservation-card.admin-reserva');
            data.pendientes.forEach((reserva, i) => {
                const reservaId = parseInt(reserva.id, 10);
                if (!cards[i]) return;
                cards[i].querySelector('.approve-btn').addEventListener('click', () => decidirReserva(reservaId, 'aprobar'));
                cards[i].querySelector('.reject-btn').addEventListener('click',  () => decidirReserva(reservaId, 'rechazar'));
            });

        } catch (err) {
            console.error('Error loadAdminReservas:', err);
            adminReservasList.innerHTML = '<p class="error-text">Error de conexión.</p>';
        }
    }

// ============================================
    // PERFIL: HISTORIAL DE RESERVAS
    // ============================================
    // Variable para almacenar todas las reservas (cache)
    let todasLasReservas = [];

    async function loadPerfilHistorial() {
        const perfilHistorial = document.getElementById('perfil-historial');
        if (!perfilHistorial) return;

        try {
            const res = await fetch('api/mis_reservas.php');
            const data = await res.json();

            if (!data.success) {
                perfilHistorial.innerHTML = `<p class="error-text">${data.message || 'No se pudo cargar el historial.'}</p>`;
                return;
            }

            // Guardar todas las reservas en la variable global
            todasLasReservas = data.reservas || [];

            // Obtener el valor del filtro
            const filtroSelect = document.getElementById('historial-filtro');
            const filtroEstado = filtroSelect ? filtroSelect.value : 'todas';

            // Aplicar el filtro y mostrar
            renderPerfilHistorial(filtroEstado);

        } catch (err) {
            console.error('Error loadPerfilHistorial:', err);
            perfilHistorial.innerHTML = '<p class="error-text">Error de conexión al cargar el historial.</p>';
        }
    }

    function renderPerfilHistorial(filtroEstado) {
        const perfilHistorial = document.getElementById('perfil-historial');
        if (!perfilHistorial) return;

        if (todasLasReservas.length === 0) {
            perfilHistorial.innerHTML = '<p>No tienes reservas en tu historial.</p>';
            return;
        }

        // Filtrar las reservas según el estado seleccionado
        let reservasFiltradas = todasLasReservas;
        if (filtroEstado !== 'todas') {
            reservasFiltradas = todasLasReservas.filter(r => r.estado === filtroEstado);
        }

        // Ordenar por fecha descendente (más reciente primero)
        reservasFiltradas.sort((a, b) => {
            const dateA = new Date(b.fecha + ' ' + b.hora_inicio);
            const dateB = new Date(a.fecha + ' ' + a.hora_inicio);
            return dateB - dateA;
        });

        if (reservasFiltradas.length === 0) {
            const mensaje = filtroEstado === 'todas' 
                ? 'No tienes reservas en tu historial.'
                : `No tienes reservas ${filtroEstado.toLowerCase()}s.`;
            perfilHistorial.innerHTML = `<p>${mensaje}</p>`;
            return;
        }

        perfilHistorial.innerHTML = reservasFiltradas.map(r => `
            <div class="reservation-card">
                <p><strong>Espacio:</strong> ${escapeHtml(r.espacio)}</p>
                <p><strong>Fecha:</strong> ${formatReservationDate(r.fecha)}</p>
                <p><strong>Hora:</strong> ${r.hora_inicio.slice(0,5)} - ${r.hora_fin.slice(0,5)}</p>
                <p><strong>Estado:</strong>
                    <span class="estado-${r.estado.toLowerCase()}">${escapeHtml(r.estado)}</span>
                </p>
            </div>
        `).join('');
    }

    // Event listener para el filtro de historial
    function setupHistorialFiltro() {
        const filtroSelect = document.getElementById('historial-filtro');
        if (filtroSelect) {
            filtroSelect.addEventListener('change', (e) => {
                renderPerfilHistorial(e.target.value);
            });
        }
    }

    // ============================================
    // DECIDIR RESERVA (aprobar / rechazar)
    // ============================================
    async function decidirReserva(reservaId, accion) {
        const label = accion === 'aprobar' ? 'Aprobar' : 'Rechazar';
        if (!confirm(`¿${label} esta reserva?`)) return;

        try {
            const res  = await fetch('api/admin_decidir_reserva.php', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ id: reservaId, accion })
            });
            const data = await res.json();

            if (data.success) {
                alert(accion === 'aprobar' ? '✅ Reserva aprobada' : '✅ Reserva rechazada');
                loadAdminReservas();
            } else {
                alert('❌ ' + (data.message || 'No se pudo procesar'));
            }
        } catch (err) {
            alert('❌ Error de conexión: ' + err.message);
        }
    }

// ============================================
    // ACTIVAR VISTA
    // ============================================
    function activateView(viewName) {
        views.forEach(v => v.classList.remove('active'));
        menuButtons.forEach(b => b.classList.remove('active'));

        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) targetView.classList.add('active');

        const targetBtn = document.querySelector(`.menu-item[data-view="${viewName}"]`);
        if (targetBtn) targetBtn.classList.add('active');

        // Cargar datos según la vista
        if (viewName === 'mis-reservas') loadMisReservas();
        if (viewName === 'disponibilidad') loadDisponibilidad();
        if (viewName === 'admin-reservas') loadAdminReservas();
        if (viewName === 'perfil') loadPerfilHistorial();
    }

// ============================================
    // DETECTAR ROL DESDE HTML Y AJUSTAR VISTA INICIAL
    // ============================================
    // El rol se pasa desde PHP en un data attribute del body
    const bodyElement = document.querySelector('.dashboard-body');
    const userRol = bodyElement ? bodyElement.getAttribute('data-user-role') : null;

    // Si es practicante, la vista inicial debe ser disponibilidad
    if (userRol === 'practicante') {
        const disponibilidadView = document.getElementById('view-disponibilidad');
        const disponibilidadBtn = document.querySelector('.menu-item[data-view="disponibilidad"]');
        
        views.forEach(v => v.classList.remove('active'));
        menuButtons.forEach(b => b.classList.remove('active'));
        
        if (disponibilidadView) disponibilidadView.classList.add('active');
        if (disponibilidadBtn) disponibilidadBtn.classList.add('active');
        
        loadDisponibilidad(); // Cargar disponibilidad al inicio
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    menuButtons.forEach(btn => {
        btn.addEventListener('click', () => activateView(btn.dataset.view));
    });

    // Botones de navegación semana en Mis reservas
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const todayWeekBtn = document.getElementById('today-week');

    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            loadMisReservas();
        });
    }

    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            loadMisReservas();
        });
    }

    if (todayWeekBtn) {
        todayWeekBtn.addEventListener('click', () => {
            currentWeekStart = getMonday(new Date());
            loadMisReservas();
        });
    }

    // Filtro de fecha en disponibilidad
    const dispDateFilter = document.getElementById('disp-date-filter');
    if (dispDateFilter) {
        dispDateFilter.addEventListener('change', () => {
            syncStateFromInput();
            loadDisponibilidad();
        });
    }

    const dispVerBtn = document.getElementById('disp-ver-btn');
    if (dispVerBtn) {
        dispVerBtn.addEventListener('click', () => {
            syncStateFromInput();
            loadDisponibilidad();
        });
    }

    // ============================================
    // FORM: Nueva reserva
    // ============================================
    if (nuevaReservaForm) {
        nuevaReservaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            nuevaReservaMsg.textContent = '';
            nuevaReservaMsg.className   = 'form-msg';

            const formData = new FormData(nuevaReservaForm);
            const payload  = {
                fecha:                  formData.get('fecha'),
                hora_inicio:            formData.get('hora_inicio'),
                hora_fin:               formData.get('hora_fin'),
                espacio:                formData.get('espacio'),
                requisitos_adicionales: formData.get('requisitos_adicionales')
            };

            try {
                const res  = await fetch('api/nueva_reserva.php', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    nuevaReservaMsg.textContent = data.message || 'Reserva creada.';
                    nuevaReservaMsg.classList.add('ok');
                    nuevaReservaForm.reset();
                    loadMisReservas();
                    loadDisponibilidad();
                } else {
                    nuevaReservaMsg.textContent = data.message || 'No se pudo crear la reserva.';
                    nuevaReservaMsg.classList.add('error');
                }
            } catch (err) {
                console.error('Error nueva reserva:', err);
                nuevaReservaMsg.textContent = 'Error de conexión.';
                nuevaReservaMsg.classList.add('error');
            }
        });
    }

    // ============================================
    // FORM: Cambiar contraseña
    // ============================================
    const cambiarPasswordForm = document.getElementById('cambiar-password-form');
    if (cambiarPasswordForm) {
        cambiarPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentPass = document.getElementById('current-password').value;
            const newPass     = document.getElementById('new-password').value;
            const confirmPass = document.getElementById('confirm-password').value;
            const msg         = document.getElementById('password-msg');

            msg.textContent = '';
            msg.className   = 'form-msg';

            if (newPass !== confirmPass) {
                msg.textContent = 'Las nuevas contraseñas no coinciden';
                msg.classList.add('error');
                return;
            }
            if (newPass.length < 8) {
                msg.textContent = 'Nueva contraseña debe tener 8+ caracteres';
                msg.classList.add('error');
                return;
            }

            try {
                const res  = await fetch('api/cambiar_password.php', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body:    `current_password=${encodeURIComponent(currentPass)}&new_password=${encodeURIComponent(newPass)}&confirm_password=${encodeURIComponent(confirmPass)}`
                });
                const data = await res.json();

                if (data.success) {
                    msg.textContent = data.message;
                    msg.classList.add('ok');
                    cambiarPasswordForm.reset();
                } else {
                    msg.textContent = data.message;
                    msg.classList.add('error');
                }
            } catch (err) {
                console.error('Error cambiar password:', err);
                msg.textContent = 'Error de conexión';
                msg.classList.add('error');
            }
        });
    }

// ============================================
    // CALIFICAR SERVICIO (Modal)
    // ============================================
    let calificacionSeleccionada = 0;

    function initCalificarServicio() {
        const btnCalificar = document.getElementById('btn-calificar-servicio');
        const modal = document.getElementById('modal-calificar');
        const modalClose = modal?.querySelector('.modal-close');
        const ratingBtns = document.querySelectorAll('.rating-btn');
        const btnEnviar = document.getElementById('btn-enviar-calificacion');
        const ratingSelection = document.getElementById('rating-selection');

        if (!btnCalificar || !modal) return;

        // Abrir modal
        btnCalificar.addEventListener('click', () => {
            modal.style.display = 'block';
            calificacionSeleccionada = 0;
            if (btnEnviar) btnEnviar.disabled = true;
            if (ratingSelection) ratingSelection.textContent = '';
            const commentBox = document.getElementById('rating-comment');
            if (commentBox) commentBox.value = '';
            const msg = document.getElementById('rating-msg');
            if (msg) { msg.textContent = ''; msg.className = 'form-msg'; }
        });

        // Cerrar modal
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Selección de rating
        ratingBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                calificacionSeleccionada = parseInt(btn.getAttribute('data-value'), 10);
                ratingBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                if (ratingSelection) {
                    ratingSelection.textContent = '⭐'.repeat(calificacionSeleccionada) + ' ' + calificacionSeleccionada + '/10';
                }
                if (btnEnviar) btnEnviar.disabled = false;
            });
        });

        // Enviar calificación
        if (btnEnviar) {
            btnEnviar.addEventListener('click', async () => {
                if (calificacionSeleccionada < 1 || calificacionSeleccionada > 10) return;

                const commentBox = document.getElementById('rating-comment');
                const comentario = commentBox ? commentBox.value.trim() : '';
                const msg = document.getElementById('rating-msg');

                try {
                    const res = await fetch('api/calificar_servicio.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            calificacion: calificacionSeleccionada,
                            comentario: comentario
                        })
                    });
                    const data = await res.json();

                    if (data.success) {
                        if (msg) {
                            msg.textContent = '✅ ¡Gracias por tu calificación!';
                            msg.classList.add('ok');
                        }
                        setTimeout(() => {
                            modal.style.display = 'none';
                        }, 1500);
                    } else {
                        if (msg) {
                            msg.textContent = '❌ ' + (data.message || 'Error al enviar');
                            msg.classList.add('error');
                        }
                    }
                } catch (err) {
                    if (msg) {
                        msg.textContent = '❌ Error de conexión';
                        msg.classList.add('error');
                    }
                }
            });
        }
    }

    // ============================================
    // INICIALIZACIÓN
    // ============================================
    loadRuntimeLinks();
    setupHistorialFiltro();
    initCalificarServicio();
    activateView('mis-reservas');
});
