# TODO - Bug Fixes: Sistema de Reservas

## Plan de implementación

### [x] PASO 1: js/dashboard.js
- [x] Agregar función `formatReservationDate()` en scope global (antes de usarse)
- [x] Mover `loadAdminReservas()` fuera del bloque `if (adminReservasList)` para corregir scope
- [x] Actualizar `decidirReserva()` para llamar `admin_decidir_reserva.php` con JSON `{id, accion}`
- [x] Agregar listener para filtro de fecha en disponibilidad

### [x] PASO 2: api/admin_decidir_reserva.php
- [x] Cambiar lectura de `$_POST` a JSON input (`php://input`)
- [x] Agregar JOIN para obtener email y nombre del usuario de la reserva
- [x] Integrar `send_approval_email()` al aprobar
- [x] Manejo de errores: email falla pero aprobación continúa

### [x] PASO 3: api/mail_helper.php
- [x] Hacer require de PHPMailer condicional (no fatal si no existe)
- [x] Agregar función `send_approval_email()`
- [x] Agregar función `send_rejection_email()`
- [x] Usar `mail()` nativo como fallback si PHPMailer no está disponible
- [x] Construir HTML profesional para el email
- [x] Mantener logging a archivo para debugging

### [x] PASO 4: dashboard.php + Style.css
- [x] Agregar input `disp-date-filter` con fecha de hoy por defecto
- [x] Agregar botón "Ver disponibilidad" para recargar al cambiar fecha
- [x] Agregar CSS `.disp-filter-bar` en Style.css

## Estado
- [x] PASO 1 completado
- [x] PASO 2 completado
- [x] PASO 3 completado
- [x] PASO 4 completado

## ✅ TODOS LOS BUGS RESUELTOS
