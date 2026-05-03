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

    let currentWeekStart = new Date();

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
                    <p><strong>Espacio:</strong> ${r.espacio}</p>
                    <p><strong>Fecha:</strong> ${formatReservationDate(r.fecha)}</p>
                    <p><strong>Hora:</strong> ${r.hora_inicio.slice(0,5)} - ${r.hora_fin.slice(0,5)}</p>
                    <p><strong>Estado:</strong>
                        <span class="estado-${r.estado.toLowerCase()}">${r.estado}</span>
                    </p>
                </div>
            `).join('');

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
            
            // Debug: Ver exactamente qué está llegando del servidor
            console.log(`Datos recibidos para ${fecha}:`, data.reservas);

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

                    const b1busy = reservas.some(r => r.espacio === 'B1' && overlaps(r.hora_inicio, r.hora_fin, hour));
                    const b2busy = reservas.some(r => r.espacio === 'B2' && overlaps(r.hora_inicio, r.hora_fin, hour));
                    const b3busy = reservas.some(r => r.espacio === 'B3' && overlaps(r.hora_inicio, r.hora_fin, hour));

                    espacios.forEach(espacio => {
                        const td = document.createElement('td');

                        if (espacio === 'B1') {
                            if (b1busy || b3busy) {
                                td.className   = b1busy ? 'slot occupied' : 'slot blocked';
                                td.textContent = b1busy ? 'Ocupado' : 'Bloqueado';
                            } else {
                                td.className   = 'slot available';
                                td.textContent = 'Disponible';
                            }
                        } else if (espacio === 'B2') {
                            if (b2busy || b3busy) {
                                td.className   = b2busy ? 'slot occupied' : 'slot blocked';
                                td.textContent = b2busy ? 'Ocupado' : 'Bloqueado';
                            } else {
                                td.className   = 'slot available';
                                td.textContent = 'Disponible';
                            }
                        } else { // B3
                            if (b3busy) {
                                td.className   = 'slot occupied';
                                td.textContent = 'Ocupado';
                            } else if (b1busy || b2busy) {
                                td.className   = 'slot blocked';
                                td.textContent = 'Bloqueado';
                            } else {
                                td.className   = 'slot available';
                                td.textContent = 'Disponible';
                            }
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

            adminReservasList.innerHTML = data.pendientes.map(reserva => {
                // Obtener ID de forma robusta (cualquier variante de nombre)
                const rawId  = reserva.id ?? reserva.ID ?? reserva.reserva_id ?? reserva.id_reserva ?? '';
                const safeId = String(rawId).trim();

                return `
                <div class="reservation-card admin-reserva">
                    <div class="reserva-actions">
                        <button class="admin-btn approve-btn"
                                data-id="${safeId}" data-accion="aprobar"
                                title="Aprobar">✔️ Aprobar</button>
                        <button class="admin-btn reject-btn"
                                data-id="${safeId}" data-accion="rechazar"
                                title="Rechazar">❌ Rechazar</button>
                    </div>
                    <div class="reserva-info">
                        <p><strong>${reserva.espacio}</strong> |
                           ${formatReservationDate(reserva.fecha)} | Estado: PENDIENTE</p>
                        <p><strong>Usuario:</strong> ${reserva.usuario}</p>
                        <p><strong>Horas:</strong>
                           ${reserva.hora_inicio.slice(0,5)} - ${reserva.hora_fin.slice(0,5)}</p>
                        <p><strong>Requisitos:</strong> ${reserva.requisitos || 'Ninguno'}</p>
                    </div>
                </div>`;
            }).join('');

            // Listeners directos (evita problemas con onclick inline)
            adminReservasList.querySelectorAll('.admin-btn[data-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    window.decidirReserva(
                        btn.getAttribute('data-id'),
                        btn.getAttribute('data-accion')
                    );
                });
            });

        } catch (err) {
            console.error('Error loadAdminReservas:', err);
            adminReservasList.innerHTML = '<p class="error-text">Error de conexión.</p>';
        }
    }

    // ============================================
    // DECIDIR RESERVA (aprobar / rechazar)
    // ============================================
    window.decidirReserva = async (id, accion) => {
        const idNum = parseInt(String(id).trim(), 10);
        console.log('decidirReserva → id:', id, '| idNum:', idNum, '| accion:', accion);

        if (!Number.isInteger(idNum) || idNum <= 0) {
            console.error('ID inválido recibido:', id);
            alert('Error: ID de reserva inválido (' + id + ')');
            return;
        }

        if (!['aprobar', 'rechazar'].includes(accion)) {
            alert('Error: Acción no válida');
            return;
        }

        const mensaje = accion === 'aprobar' ? 'Aprobar esta reserva' : 'Rechazar esta reserva';
        if (!confirm(`¿${mensaje}?`)) return;

        try {
            const res = await fetch('api/admin_decidir_reserva.php', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ id: idNum, accion })
            });

            const data = await res.json();
            console.log('Respuesta servidor:', data);

            if (data.success) {
                alert(accion === 'aprobar'
                    ? '✅ Reserva aprobada correctamente'
                    : '✅ Reserva rechazada');
                loadAdminReservas();
            } else {
                alert('❌ Error: ' + (data.message || 'No se pudo procesar'));
            }
        } catch (err) {
            console.error('Error en decidirReserva:', err);
            alert('❌ Error de conexión: ' + err.message);
        }
    };

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

        if (viewName === 'mis-reservas') loadMisReservas();
        if (viewName === 'disponibilidad') loadDisponibilidad();
        if (viewName === 'admin-reservas') loadAdminReservas();
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
            currentWeekStart = new Date();
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
    // INICIALIZACIÓN
    // ============================================
    loadRuntimeLinks();
    activateView('mis-reservas');
});
