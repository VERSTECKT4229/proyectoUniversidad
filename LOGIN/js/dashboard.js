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

            if (data.dia_bloqueado) {
                const motivo = data.motivo_bloqueo ? ` — Motivo: ${escapeHtml(data.motivo_bloqueo)}` : '';
                disponibilidadCalendar.innerHTML = `
                    <div class="dia-bloqueado-banner">
                        <span class="dia-bloqueado-icon">⛔</span>
                        <div>
                            <strong>Día bloqueado por la administración</strong>${motivo}
                            <p>No se pueden hacer reservas en esta fecha.</p>
                        </div>
                    </div>`;
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
                        const match = reservas.find(r => r.espacio === espacio && overlaps(r.hora_inicio, r.hora_fin, hour));

                        if (match) {
                            if (match.tipo === 'bloqueado') {
                                td.className   = 'slot blocked';
                                td.innerHTML   = '⛔ Bloqueado';
                                td.title       = espacio === 'B3'
                                    ? 'B3 no disponible: B1 o B2 está ocupado'
                                    : `${espacio} no disponible: B3 está reservado`;
                            } else {
                                td.className   = 'slot occupied';
                                td.textContent = 'Ocupado';
                            }
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
    // ADMIN: GESTIÓN DE RESERVAS
    // ============================================
    function setMsgAdminReservas(msg, tipo) {
        const el = document.getElementById('admin-reservas-msg');
        if (!el) return;
        el.textContent = msg;
        el.className = 'form-msg ' + tipo;
        if (msg) setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 3500);
    }

    async function loadAdminReservas() {
        const tbody = document.getElementById('admin-reservas-tbody');
        const count = document.getElementById('admin-reservas-count');
        if (!tbody) return;

        const estado  = document.getElementById('filtro-estado')?.value  || '';
        const espacio = document.getElementById('filtro-espacio')?.value || '';

        tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Cargando...</td></tr>`;

        try {
            const params = new URLSearchParams();
            if (estado)  params.set('estado',  estado);
            if (espacio) params.set('espacio', espacio);

            const res  = await fetch('api/admin_gestionar_reserva.php?' + params.toString());
            const data = await res.json();

            if (!data.success) {
                tbody.innerHTML = `<tr><td colspan="7" class="table-empty error-text">${escapeHtml(data.message)}</td></tr>`;
                return;
            }

            const reservas = data.reservas || [];
            if (count) count.textContent = reservas.length + ' reserva' + (reservas.length !== 1 ? 's' : '');

            if (!reservas.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No hay reservas con esos filtros.</td></tr>';
                return;
            }

            tbody.innerHTML = reservas.map(r => {
                const esPendiente = r.estado === 'Pendiente';
                const accionesPendiente = esPendiente ? `
                    <button class="btn-aprobar"  data-id="${r.id}" title="Aprobar">✔ Aprobar</button>
                    <button class="btn-rechazar" data-id="${r.id}" title="Rechazar">✖ Rechazar</button>
                ` : '';
                return `
                <tr data-id="${r.id}">
                    <td class="td-id">${r.id}</td>
                    <td><span class="td-nombre">${escapeHtml(r.usuario)}</span><br>
                        <span class="td-email">${escapeHtml(r.email)}</span></td>
                    <td><span class="espacio-badge espacio-${r.espacio.toLowerCase()}">${r.espacio}</span></td>
                    <td class="td-date">${formatReservationDate(r.fecha)}</td>
                    <td class="td-date">${r.hora_inicio.slice(0,5)} – ${r.hora_fin.slice(0,5)}</td>
                    <td><span class="estado-${r.estado.toLowerCase()}">${escapeHtml(r.estado)}</span></td>
                    <td class="td-actions td-actions--wrap">
                        ${accionesPendiente}
                        <button class="btn-table-edit"   data-id="${r.id}">Editar</button>
                        <button class="btn-table-delete" data-id="${r.id}">Eliminar</button>
                    </td>
                </tr>`;
            }).join('');

            // Guardar datos en el DOM para edición sin re-fetch
            reservas.forEach(r => {
                const row = tbody.querySelector(`tr[data-id="${r.id}"]`);
                if (row) row.dataset.json = JSON.stringify(r);
            });

            // Aprobar
            tbody.querySelectorAll('.btn-aprobar').forEach(btn => {
                const id = parseInt(btn.dataset.id, 10);
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Aprobar esta reserva?')) return;
                    await accionReserva(id, 'aprobar');
                });
            });

            // Rechazar
            tbody.querySelectorAll('.btn-rechazar').forEach(btn => {
                const id = parseInt(btn.dataset.id, 10);
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Rechazar esta reserva?')) return;
                    await accionReserva(id, 'rechazar');
                });
            });

            // Editar
            tbody.querySelectorAll('.btn-table-edit').forEach(btn => {
                btn.addEventListener('click', () => {
                    const r = JSON.parse(btn.closest('tr').dataset.json);
                    document.getElementById('er-id').value          = r.id;
                    document.getElementById('er-usuario').value     = r.usuario;
                    document.getElementById('er-espacio').value     = r.espacio;
                    document.getElementById('er-fecha').value       = r.fecha;
                    document.getElementById('er-hora-inicio').value = r.hora_inicio.slice(0, 5);
                    document.getElementById('er-hora-fin').value    = r.hora_fin.slice(0, 5);
                    document.getElementById('er-estado').value      = r.estado;
                    document.getElementById('er-requisitos').value  = r.requisitos || '';
                    const msgEl = document.getElementById('modal-er-msg');
                    if (msgEl) { msgEl.textContent = ''; msgEl.className = 'form-msg'; }
                    openModal('modal-editar-reserva');
                });
            });

            // Eliminar
            tbody.querySelectorAll('.btn-table-delete').forEach(btn => {
                const id = parseInt(btn.dataset.id, 10);
                btn.addEventListener('click', async () => {
                    const r = JSON.parse(btn.closest('tr').dataset.json);
                    if (!confirm(`¿Eliminar la reserva #${id} de ${r.usuario}?\nEsta acción no se puede deshacer.`)) return;
                    try {
                        const res  = await fetch('api/admin_gestionar_reserva.php', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id })
                        });
                        const data = await res.json();
                        if (data.success) { setMsgAdminReservas(data.message, 'ok'); loadAdminReservas(); }
                        else              { setMsgAdminReservas(data.message, 'error'); }
                    } catch { setMsgAdminReservas('Error de conexión.', 'error'); }
                });
            });

        } catch (err) {
            console.error('loadAdminReservas:', err);
            tbody.innerHTML = '<tr><td colspan="7" class="table-empty error-text">Error de conexión.</td></tr>';
        }
    }

    async function accionReserva(id, accion) {
        try {
            const res  = await fetch('api/admin_gestionar_reserva.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, accion })
            });
            const data = await res.json();
            if (data.success) { setMsgAdminReservas(data.message, 'ok'); loadAdminReservas(); }
            else              { setMsgAdminReservas(data.message, 'error'); }
        } catch { setMsgAdminReservas('Error de conexión.', 'error'); }
    }

    // Botón filtrar
    document.getElementById('btn-filtrar-reservas')?.addEventListener('click', loadAdminReservas);

    // Submit editar reserva
    const formEditarReserva = document.getElementById('form-editar-reserva');
    if (formEditarReserva) {
        formEditarReserva.addEventListener('submit', async e => {
            e.preventDefault();
            const msgEl = document.getElementById('modal-er-msg');
            const payload = {
                id:          parseInt(document.getElementById('er-id').value, 10),
                espacio:     document.getElementById('er-espacio').value,
                fecha:       document.getElementById('er-fecha').value,
                hora_inicio: document.getElementById('er-hora-inicio').value,
                hora_fin:    document.getElementById('er-hora-fin').value,
                estado:      document.getElementById('er-estado').value,
                requisitos:  document.getElementById('er-requisitos').value.trim()
            };

            try {
                const res  = await fetch('api/admin_gestionar_reserva.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    closeModal('modal-editar-reserva');
                    setMsgAdminReservas(data.message, 'ok');
                    loadAdminReservas();
                } else {
                    if (msgEl) { msgEl.textContent = data.message; msgEl.className = 'form-msg error'; }
                }
            } catch {
                if (msgEl) { msgEl.textContent = 'Error de conexión.'; msgEl.className = 'form-msg error'; }
            }
        });
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
        if (viewName === 'inicio')                  loadDashboardStats();
        if (viewName === 'mis-reservas')            loadMisReservas();
        if (viewName === 'nueva-reserva')           loadRecursosParaReserva();
        if (viewName === 'disponibilidad')          loadDisponibilidad();
        if (viewName === 'admin-reservas')          loadAdminReservas();
        if (viewName === 'perfil')                  loadPerfilHistorial();
        if (viewName === 'admin-usuarios')          loadAdminUsuarios();
        if (viewName === 'admin-recursos')          loadAdminRecursos();
        if (viewName === 'admin-dias')              loadAdminDias();
        if (viewName === 'coordinador-dashboard')   loadCoordinadorDashboard();

    }

// ============================================
    // DETECTAR ROL DESDE HTML Y AJUSTAR VISTA INICIAL
    // ============================================
    // El rol se pasa desde PHP en un data attribute del body
    const bodyElement = document.querySelector('.dashboard-body');
    const userRol = bodyElement ? bodyElement.getAttribute('data-user-role') : null;

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
                requisitos_adicionales: formData.get('requisitos_adicionales'),
                recursos:               getRecursosSeleccionados()
            };

            if (payload.hora_inicio < '08:00' || payload.hora_fin > '21:00') {
                nuevaReservaMsg.textContent = 'Las reservas deben estar entre las 08:00 y las 21:00.';
                nuevaReservaMsg.className   = 'form-msg error';
                return;
            }

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
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ current_password: currentPass, new_password: newPass, confirm_password: confirmPass })
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
    // UTILIDAD: ABRIR / CERRAR MODALES
    // ============================================
    function openModal(id) {
        const m = document.getElementById(id);
        if (m) m.style.display = 'flex';
    }

    function closeModal(id) {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    }

    // Cerrar modal al hacer clic en X o en el botón Cancelar
    document.querySelectorAll('.modal-close, [data-modal]').forEach(el => {
        el.addEventListener('click', () => closeModal(el.dataset.modal));
    });

    // Cerrar al hacer clic fuera del contenido
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // ============================================
    // CRUD — USUARIOS
    // ============================================
    let usuariosModo = 'crear'; // 'crear' | 'editar'

    function setMsgUsuario(msg, tipo) {
        const el = document.getElementById('modal-usuario-msg');
        if (!el) return;
        el.textContent = msg;
        el.className = 'form-msg ' + tipo;
    }

    function setMsgUsuarioVista(msg, tipo) {
        const el = document.getElementById('admin-usuarios-msg');
        if (!el) return;
        el.textContent = msg;
        el.className = 'form-msg ' + tipo;
        setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 3500);
    }

    function rolBadge(rol) {
        const map = {
            administrativo: 'badge-admin',
            coordinador:    'badge-coordinador',
            docente:        'badge-docente',
            externo:        'badge-externo',
            practicante:    'badge-practicante'
        };
        return `<span class="rol-badge ${map[rol] || ''}">${escapeHtml(rol)}</span>`;
    }

    async function loadAdminUsuarios() {
        const tbody = document.getElementById('admin-usuarios-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Cargando...</td></tr>';

        try {
            const res  = await fetch('api/admin_usuarios.php');
            const data = await res.json();

            if (!data.success) {
                tbody.innerHTML = `<tr><td colspan="6" class="table-empty error-text">${escapeHtml(data.message)}</td></tr>`;
                return;
            }

            if (!data.usuarios.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No hay usuarios registrados.</td></tr>';
                return;
            }

            tbody.innerHTML = data.usuarios.map(u => `
                <tr data-id="${u.id}">
                    <td class="td-id">${u.id}</td>
                    <td>${escapeHtml(u.nombre)}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td>${rolBadge(u.rol)}</td>
                    <td class="td-date">${formatReservationDate(u.created_at)}</td>
                    <td class="td-actions">
                        <button class="btn-table-edit"   data-id="${u.id}">Editar</button>
                        <button class="btn-table-delete" data-id="${u.id}">Eliminar</button>
                    </td>
                </tr>
            `).join('');

            // Guardar datos en el DOM para edición sin re-fetch
            data.usuarios.forEach(u => {
                const row = tbody.querySelector(`tr[data-id="${u.id}"]`);
                if (row) row.dataset.json = JSON.stringify(u);
            });

            tbody.querySelectorAll('.btn-table-edit').forEach(btn => {
                btn.addEventListener('click', () => {
                    const row  = btn.closest('tr');
                    const u    = JSON.parse(row.dataset.json);
                    usuariosModo = 'editar';
                    document.getElementById('modal-usuario-title').textContent = 'Editar usuario';
                    document.getElementById('usuario-id').value      = u.id;
                    document.getElementById('usuario-nombre').value  = u.nombre;
                    document.getElementById('usuario-email').value   = u.email;
                    document.getElementById('usuario-password').value = '';
                    document.getElementById('usuario-rol').value     = u.rol;
                    document.getElementById('pass-hint').textContent = '(dejar vacío para no cambiar)';
                    setMsgUsuario('', '');
                    openModal('modal-usuario');
                });
            });

            tbody.querySelectorAll('.btn-table-delete').forEach(btn => {
                const uid = parseInt(btn.dataset.id, 10);
                btn.addEventListener('click', async () => {
                    const row  = btn.closest('tr');
                    const nombre = JSON.parse(row.dataset.json).nombre;
                    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
                    try {
                        const res  = await fetch('api/admin_usuarios.php', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: uid })
                        });
                        const data = await res.json();
                        if (data.success) {
                            setMsgUsuarioVista(data.message, 'ok');
                            loadAdminUsuarios();
                        } else {
                            setMsgUsuarioVista(data.message, 'error');
                        }
                    } catch { setMsgUsuarioVista('Error de conexión.', 'error'); }
                });
            });

        } catch { tbody.innerHTML = '<tr><td colspan="6" class="table-empty error-text">Error de conexión.</td></tr>'; }
    }

    // Botón "Nuevo usuario"
    const btnNuevoUsuario = document.getElementById('btn-nuevo-usuario');
    if (btnNuevoUsuario) {
        btnNuevoUsuario.addEventListener('click', () => {
            usuariosModo = 'crear';
            document.getElementById('modal-usuario-title').textContent = 'Nuevo usuario';
            document.getElementById('form-usuario').reset();
            document.getElementById('usuario-id').value = '';
            document.getElementById('pass-hint').textContent = '(mínimo 8 caracteres)';
            setMsgUsuario('', '');
            openModal('modal-usuario');
        });
    }

    // Submit formulario usuario
    const formUsuario = document.getElementById('form-usuario');
    if (formUsuario) {
        formUsuario.addEventListener('submit', async e => {
            e.preventDefault();
            const id       = document.getElementById('usuario-id').value;
            const nombre   = document.getElementById('usuario-nombre').value.trim();
            const email    = document.getElementById('usuario-email').value.trim();
            const password = document.getElementById('usuario-password').value;
            const rol      = document.getElementById('usuario-rol').value;

            setMsgUsuario('', '');

            try {
                let res, data;
                if (usuariosModo === 'crear') {
                    res  = await fetch('api/admin_usuarios.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nombre, email, password, rol })
                    });
                } else {
                    const payload = { id: parseInt(id, 10), nombre, email, rol };
                    if (password) payload.password = password;
                    res  = await fetch('api/admin_usuarios.php', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }
                data = await res.json();
                if (data.success) {
                    closeModal('modal-usuario');
                    setMsgUsuarioVista(data.message, 'ok');
                    loadAdminUsuarios();
                } else {
                    setMsgUsuario(data.message, 'error');
                }
            } catch { setMsgUsuario('Error de conexión.', 'error'); }
        });
    }

    // ============================================
    // CRUD — RECURSOS
    // ============================================
    let recursosModo = 'crear';

    function setMsgRecurso(msg, tipo) {
        const el = document.getElementById('modal-recurso-msg');
        if (!el) return;
        el.textContent = msg;
        el.className = 'form-msg ' + tipo;
    }

    function setMsgRecursoVista(msg, tipo) {
        const el = document.getElementById('admin-recursos-msg');
        if (!el) return;
        el.textContent = msg;
        el.className = 'form-msg ' + tipo;
        setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 3500);
    }

    async function loadAdminRecursos() {
        const tbody = document.getElementById('admin-recursos-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Cargando...</td></tr>';

        try {
            const res  = await fetch('api/admin_recursos.php');
            const data = await res.json();

            if (!data.success) {
                tbody.innerHTML = `<tr><td colspan="5" class="table-empty error-text">${escapeHtml(data.message)}</td></tr>`;
                return;
            }

            if (!data.recursos.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No hay recursos registrados.</td></tr>';
                return;
            }

            tbody.innerHTML = data.recursos.map(r => `
                <tr data-id="${r.id}">
                    <td class="td-id">${r.id}</td>
                    <td><strong>${escapeHtml(r.nombre)}</strong></td>
                    <td class="td-desc">${escapeHtml(r.descripcion || '—')}</td>
                    <td><span class="cantidad-badge">${r.cantidad}</span></td>
                    <td class="td-actions">
                        <button class="btn-table-edit"   data-id="${r.id}">Editar</button>
                        <button class="btn-table-delete" data-id="${r.id}">Eliminar</button>
                    </td>
                </tr>
            `).join('');

            data.recursos.forEach(r => {
                const row = tbody.querySelector(`tr[data-id="${r.id}"]`);
                if (row) row.dataset.json = JSON.stringify(r);
            });

            tbody.querySelectorAll('.btn-table-edit').forEach(btn => {
                btn.addEventListener('click', () => {
                    const row = btn.closest('tr');
                    const r   = JSON.parse(row.dataset.json);
                    recursosModo = 'editar';
                    document.getElementById('modal-recurso-title').textContent = 'Editar recurso';
                    document.getElementById('recurso-id').value          = r.id;
                    document.getElementById('recurso-nombre').value      = r.nombre;
                    document.getElementById('recurso-descripcion').value = r.descripcion || '';
                    document.getElementById('recurso-cantidad').value    = r.cantidad;
                    setMsgRecurso('', '');
                    openModal('modal-recurso');
                });
            });

            tbody.querySelectorAll('.btn-table-delete').forEach(btn => {
                const rid = parseInt(btn.dataset.id, 10);
                btn.addEventListener('click', async () => {
                    const row    = btn.closest('tr');
                    const nombre = JSON.parse(row.dataset.json).nombre;
                    if (!confirm(`¿Eliminar el recurso "${nombre}"?`)) return;
                    try {
                        const res  = await fetch('api/admin_recursos.php', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: rid })
                        });
                        const data = await res.json();
                        if (data.success) {
                            setMsgRecursoVista(data.message, 'ok');
                            loadAdminRecursos();
                        } else {
                            setMsgRecursoVista(data.message, 'error');
                        }
                    } catch { setMsgRecursoVista('Error de conexión.', 'error'); }
                });
            });

        } catch { tbody.innerHTML = '<tr><td colspan="5" class="table-empty error-text">Error de conexión.</td></tr>'; }
    }

    // Botón "Nuevo recurso"
    const btnNuevoRecurso = document.getElementById('btn-nuevo-recurso');
    if (btnNuevoRecurso) {
        btnNuevoRecurso.addEventListener('click', () => {
            recursosModo = 'crear';
            document.getElementById('modal-recurso-title').textContent = 'Nuevo recurso';
            document.getElementById('form-recurso').reset();
            document.getElementById('recurso-id').value = '';
            setMsgRecurso('', '');
            openModal('modal-recurso');
        });
    }

    // Submit formulario recurso
    const formRecurso = document.getElementById('form-recurso');
    if (formRecurso) {
        formRecurso.addEventListener('submit', async e => {
            e.preventDefault();
            const id          = document.getElementById('recurso-id').value;
            const nombre      = document.getElementById('recurso-nombre').value.trim();
            const descripcion = document.getElementById('recurso-descripcion').value.trim();
            const cantidad    = parseInt(document.getElementById('recurso-cantidad').value, 10);

            setMsgRecurso('', '');

            try {
                const method  = recursosModo === 'crear' ? 'POST' : 'PUT';
                const payload = recursosModo === 'crear'
                    ? { nombre, descripcion, cantidad }
                    : { id: parseInt(id, 10), nombre, descripcion, cantidad };

                const res  = await fetch('api/admin_recursos.php', {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    closeModal('modal-recurso');
                    setMsgRecursoVista(data.message, 'ok');
                    loadAdminRecursos();
                } else {
                    setMsgRecurso(data.message, 'error');
                }
            } catch { setMsgRecurso('Error de conexión.', 'error'); }
        });
    }

    // ============================================
    // STATS — VISTA INICIO
    // ============================================
    async function loadDashboardStats() {
        try {
            const res  = await fetch('api/dashboard_stats.php');
            const data = await res.json();
            if (!data.success) return;

            const s = data.mis_stats;
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

            set('stat-total',     s.total);
            set('stat-pendientes', s.pendientes);
            set('stat-aprobadas',  s.aprobadas);
            set('stat-rechazadas', s.rechazadas);

            // Próxima reserva
            if (data.proxima) {
                const p    = data.proxima;
                const card = document.getElementById('proxima-reserva-card');
                const body = document.getElementById('proxima-body');
                if (card && body) {
                    body.innerHTML = `
                        <span class="proxima-dato"><strong>Espacio</strong> ${escapeHtml(p.espacio)}</span>
                        <span class="proxima-dato"><strong>Fecha</strong> ${formatReservationDate(p.fecha)}</span>
                        <span class="proxima-dato"><strong>Horario</strong> ${p.hora_inicio.slice(0,5)} – ${p.hora_fin.slice(0,5)}</span>
                    `;
                    card.style.display = 'block';
                }
            }

            // Stats del sistema (admin)
            if (data.sistema) {
                const sys = data.sistema;
                set('sys-total',      sys.total);
                set('sys-pendientes', sys.pendientes);
                set('sys-aprobadas',  sys.aprobadas);
                set('sys-hoy',        sys.hoy);

                const grid = document.getElementById('espacios-grid');
                if (grid && sys.por_espacio) {
                    grid.innerHTML = Object.entries(sys.por_espacio).map(([esp, tot]) => `
                        <div class="espacio-stat">
                            <span class="espacio-badge espacio-${esp.toLowerCase()}">${esp}</span>
                            <span class="espacio-num">${tot} aprobadas</span>
                        </div>
                    `).join('');
                }
            }
        } catch (e) { console.error('loadDashboardStats:', e); }
    }

    // ============================================
    // RECURSOS EN NUEVA RESERVA
    // ============================================
    let _recursosCache = null;

    async function loadRecursosParaReserva() {
        const seccion = document.getElementById('recursos-seccion');
        const lista   = document.getElementById('recursos-lista');
        if (!seccion || !lista) return;

        try {
            if (!_recursosCache) {
                const res  = await fetch('api/admin_recursos.php');
                const data = await res.json();
                _recursosCache = data.success ? (data.recursos || []) : [];
            }

            if (_recursosCache.length === 0) { seccion.style.display = 'none'; return; }

            seccion.style.display = 'block';
            lista.innerHTML = _recursosCache.map(r => `
                <label class="recurso-check-item">
                    <input type="checkbox" class="rec-check" data-id="${r.id}" data-nombre="${escapeHtml(r.nombre)}">
                    <span class="rec-info">
                        <strong>${escapeHtml(r.nombre)}</strong>
                        ${r.descripcion ? `<span class="rec-desc">${escapeHtml(r.descripcion)}</span>` : ''}
                    </span>
                    <span class="rec-cant-wrap" style="display:none;">
                        <input type="number" class="rec-cant" data-id="${r.id}" value="1" min="1" max="${r.cantidad}" style="width:60px;">
                        <span class="rec-max">/ ${r.cantidad}</span>
                    </span>
                </label>
            `).join('');

            // Toggle cantidad al marcar/desmarcar
            lista.querySelectorAll('.rec-check').forEach(chk => {
                chk.addEventListener('change', () => {
                    const cantWrap = chk.closest('.recurso-check-item').querySelector('.rec-cant-wrap');
                    if (cantWrap) cantWrap.style.display = chk.checked ? 'inline-flex' : 'none';
                });
            });

        } catch (e) { seccion.style.display = 'none'; }
    }

    // Recolectar recursos seleccionados del formulario
    function getRecursosSeleccionados() {
        const recursos = [];
        document.querySelectorAll('.rec-check:checked').forEach(chk => {
            const id   = parseInt(chk.dataset.id, 10);
            const cant = parseInt(chk.closest('.recurso-check-item').querySelector('.rec-cant')?.value || '1', 10);
            recursos.push({ id, cantidad: cant });
        });
        return recursos;
    }

    // ============================================
    // ADMIN: DÍAS BLOQUEADOS
    // ============================================
    function setMsgDias(id, msg, tipo) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg;
        el.className = 'form-msg ' + tipo;
        if (msg && tipo !== '') setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 3500);
    }

    const DIAS_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

    async function loadAdminDias() {
        const tbody = document.getElementById('admin-dias-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Cargando...</td></tr>';

        try {
            const res  = await fetch('api/admin_dias_bloqueados.php');
            const data = await res.json();
            if (!data.success) { tbody.innerHTML = `<tr><td colspan="4" class="table-empty error-text">${escapeHtml(data.message)}</td></tr>`; return; }

            if (!data.dias.length) { tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No hay días bloqueados.</td></tr>'; return; }

            tbody.innerHTML = data.dias.map(d => {
                const dt      = new Date(d.fecha + 'T00:00:00');
                const nombreDia = DIAS_ES[dt.getDay()];
                const fechaFmt  = dt.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });
                return `<tr data-id="${d.id}">
                    <td class="td-date">${fechaFmt}</td>
                    <td>${nombreDia}</td>
                    <td>${escapeHtml(d.motivo || '—')}</td>
                    <td><button class="btn-table-delete btn-desbloquear" data-id="${d.id}">Desbloquear</button></td>
                </tr>`;
            }).join('');

            tbody.querySelectorAll('.btn-desbloquear').forEach(btn => {
                const id = parseInt(btn.dataset.id, 10);
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Desbloquear este día?')) return;
                    try {
                        const res  = await fetch('api/admin_dias_bloqueados.php', {
                            method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id})
                        });
                        const data = await res.json();
                        if (data.success) { setMsgDias('admin-dias-msg', data.message, 'ok'); loadAdminDias(); }
                        else              { setMsgDias('admin-dias-msg', data.message, 'error'); }
                    } catch { setMsgDias('admin-dias-msg', 'Error de conexión.', 'error'); }
                });
            });
        } catch { tbody.innerHTML = '<tr><td colspan="4" class="table-empty error-text">Error de conexión.</td></tr>'; }
    }

    document.getElementById('btn-bloquear-dia')?.addEventListener('click', async () => {
        const fecha  = document.getElementById('dia-fecha')?.value;
        const motivo = document.getElementById('dia-motivo')?.value.trim() || '';
        if (!fecha) { setMsgDias('dias-form-msg', 'Selecciona una fecha.', 'error'); return; }

        try {
            const res  = await fetch('api/admin_dias_bloqueados.php', {
                method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({fecha, motivo})
            });
            const data = await res.json();
            if (data.success) {
                setMsgDias('dias-form-msg', data.message, 'ok');
                document.getElementById('dia-fecha').value  = '';
                document.getElementById('dia-motivo').value = '';
                loadAdminDias();
            } else { setMsgDias('dias-form-msg', data.message, 'error'); }
        } catch { setMsgDias('dias-form-msg', 'Error de conexión.', 'error'); }
    });

    // ============================================
    // COORDINADOR — DASHBOARD AVANZADO
    // ============================================
    const _coordCharts = {};

    function destroyChart(id) {
        if (_coordCharts[id]) { _coordCharts[id].destroy(); delete _coordCharts[id]; }
    }

    function buildChart(id, type, labels, datasets, options = {}) {
        destroyChart(id);
        const ctx = document.getElementById(id);
        if (!ctx) return;
        _coordCharts[id] = new Chart(ctx, {
            type,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
                ...options
            }
        });
    }

    function buildHeatmap(container, heatmapData) {
        if (!container) return;
        const dias   = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
        const horas  = [];
        for (let h = 7; h <= 19; h++) horas.push(String(h).padStart(2,'0') + ':00');

        // Construir mapa dia+hora → count
        const map = {};
        let maxVal = 1;
        heatmapData.forEach(d => {
            const key = d.dia + '|' + d.hora;
            map[key] = d.total;
            if (d.total > maxVal) maxVal = d.total;
        });

        const table = document.createElement('table');
        table.className = 'heatmap-table';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        headRow.innerHTML = '<th>Hora</th>' + dias.map(d => `<th>${d}</th>`).join('');
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        horas.forEach(hora => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<th>${hora}</th>` + dias.map(dia => {
                const val = map[dia + '|' + hora] || 0;
                const level = val === 0 ? 0 : Math.min(5, Math.ceil((val / maxVal) * 5));
                return `<td class="heatmap-${level}" title="${dia} ${hora}: ${val} reservas">${val || ''}</td>`;
            }).join('');
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        container.innerHTML = '';
        container.appendChild(table);
    }

    async function loadCoordinadorDashboard() {
        try {
            const res  = await fetch('api/dashboard_coordinador.php');
            const data = await res.json();
            if (!data.success) return;

            const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

            set('ck-total',        data.total);
            set('ck-tasa',         data.tasa_aprobacion);
            set('ck-espacio',      data.espacio_mas_usado);
            set('ck-hora-pico',    data.hora_pico);
            set('ck-calificacion', data.calificacion_prom !== null ? data.calificacion_prom + '/10' : 'N/A');

            // Gráfica por espacio (barra)
            const espacios = Object.keys(data.por_espacio || {});
            const espacioVals = Object.values(data.por_espacio || {});
            buildChart('chart-por-espacio', 'bar', espacios, [{
                label: 'Reservas aprobadas',
                data: espacioVals,
                backgroundColor: ['#3b82f6','#ec4899','#10b981'],
                borderRadius: 6
            }], { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } });

            // Gráfica por día de semana (barra horizontal)
            const diasLabels = Object.keys(data.por_dia_semana || {});
            const diasVals   = Object.values(data.por_dia_semana || {});
            buildChart('chart-por-dia', 'bar', diasLabels, [{
                label: 'Reservas',
                data: diasVals,
                backgroundColor: '#6366f1',
                borderRadius: 6
            }], { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } });

            // Tendencia semanal (línea)
            const semanaLabels = (data.tendencia_semanal || []).map(s => `Sem ${s.semana}`);
            const semanaVals   = (data.tendencia_semanal || []).map(s => s.total);
            buildChart('chart-tendencia', 'line', semanaLabels, [{
                label: 'Reservas / semana',
                data: semanaVals,
                borderColor: '#1a237e',
                backgroundColor: 'rgba(26,35,126,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4
            }], { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } });

            // Por rol (dona)
            const rolLabels = Object.keys(data.por_rol || {});
            const rolVals   = Object.values(data.por_rol || {});
            buildChart('chart-por-rol', 'doughnut', rolLabels, [{
                data: rolVals,
                backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ec4899','#7c3aed'],
                borderWidth: 2
            }]);

            // Heatmap
            buildHeatmap(document.getElementById('coord-heatmap'), data.heatmap || []);

            // Herramientas de decisión
            const decisions = document.getElementById('coord-decisions');
            if (decisions) {
                const total    = data.total || 0;
                const aprob    = data.aprobadas || 0;
                const pend     = data.pendientes || 0;
                const rechaz   = data.rechazadas || 0;
                const tasaNum  = total > 0 ? Math.round((aprob / total) * 100) : 0;
                const satClass = tasaNum >= 70 ? 'di-green' : tasaNum >= 40 ? 'di-orange' : 'di-red';
                const pendRate = total > 0 ? Math.round((pend / total) * 100) : 0;
                const pendClass= pendRate < 20 ? 'di-green' : pendRate < 40 ? 'di-orange' : 'di-red';

                decisions.innerHTML = `
                    <div class="decision-item ${satClass}">
                        <strong>Eficiencia de aprobación</strong>
                        <span>${tasaNum}%</span>
                        <p>${tasaNum >= 70 ? 'Proceso ágil — buen desempeño' : tasaNum >= 40 ? 'Margen de mejora en tiempos de respuesta' : 'Alta tasa de rechazo — revisar criterios'}</p>
                    </div>
                    <div class="decision-item ${pendClass}">
                        <strong>Reservas pendientes</strong>
                        <span>${pend}</span>
                        <p>${pendRate < 20 ? 'Backlog bajo — al día con aprobaciones' : pendRate < 40 ? 'Backlog moderado — atender pronto' : 'Backlog alto — priorizar revisión'}</p>
                    </div>
                    <div class="decision-item di-green">
                        <strong>Espacio recomendado</strong>
                        <span>${data.espacio_mas_usado}</span>
                        <p>Mayor demanda histórica — considerar ampliación o política de acceso</p>
                    </div>
                    <div class="decision-item di-orange">
                        <strong>Hora pico</strong>
                        <span>${data.hora_pico}</span>
                        <p>Mayor concentración de reservas — planificar recursos en este horario</p>
                    </div>
                    ${data.calificacion_prom !== null ? `
                    <div class="decision-item ${data.calificacion_prom >= 7 ? 'di-green' : data.calificacion_prom >= 5 ? 'di-orange' : 'di-red'}">
                        <strong>Satisfacción del servicio</strong>
                        <span>${data.calificacion_prom}/10</span>
                        <p>${data.calificacion_prom >= 7 ? 'Servicio bien evaluado' : data.calificacion_prom >= 5 ? 'Satisfacción media — identificar áreas de mejora' : 'Satisfacción baja — revisión urgente del servicio'}</p>
                    </div>` : ''}
                `;
            }

        } catch (e) {
            console.error('loadCoordinadorDashboard:', e);
        }
    }

    // ============================================
    // TOGGLE VER/OCULTAR CONTRASEÑA (dashboard)
    // ============================================
    function initPasswordToggles() {
        document.querySelectorAll('.toggle-password').forEach(eye => {
            eye.addEventListener('click', () => {
                const input = document.getElementById(eye.getAttribute('data-target'));
                if (!input) return;
                if (input.type === 'password') {
                    input.type = 'text';
                    eye.textContent = '🙈';
                } else {
                    input.type = 'password';
                    eye.textContent = '👁️';
                }
            });
        });
    }

    // ============================================
    // INICIALIZACIÓN
    // ============================================
    loadRuntimeLinks();
    setupHistorialFiltro();
    initCalificarServicio();
    initPasswordToggles();
    activateView('inicio');
});
