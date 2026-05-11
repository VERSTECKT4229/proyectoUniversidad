// Mejorador del formulario de nueva reserva
// Añade validación en tiempo real sobre fechas y días bloqueados

document.addEventListener('DOMContentLoaded', () => {
    const fechaInput = document.querySelector('#nueva-reserva-form input[name="fecha"]');
    
    if (!fechaInput) return; // Si no existe el formulario, salir
    
    // Crear elemento de advertencia
    const advertencia = document.createElement('div');
    advertencia.id = 'fecha-advertencia';
    advertencia.style.cssText = `
        margin-top: 8px;
        padding: 10px 12px;
        border-radius: 6px;
        font-size: 13px;
        display: none;
        animation: slideDown 0.3s ease;
    `;
    
    // Insertar advertencia después del input
    fechaInput.parentNode.insertBefore(advertencia, fechaInput.nextSibling);
    
    // Función para verificar si es martes o jueves
    function esDiasBloqueados(fecha) {
        const date = new Date(fecha + 'T00:00:00');
        const dia = date.getDay(); // 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
        return dia === 2 || dia === 4; // 2=martes, 4=jueves
    }
    
    function getNombreDia(fecha) {
        const date = new Date(fecha + 'T00:00:00');
        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        return dias[date.getDay()];
    }
    
    // Escuchar cambios en el input de fecha
    fechaInput.addEventListener('change', () => {
        const fecha = fechaInput.value;
        
        if (!fecha) {
            advertencia.style.display = 'none';
            return;
        }
        
        if (esDiasBloqueados(fecha)) {
            const dia = getNombreDia(fecha);
            advertencia.style.display = 'block';
            advertencia.style.background = '#fee2e2';
            advertencia.style.borderLeft = '4px solid #dc2626';
            advertencia.style.color = '#991b1b';
            advertencia.innerHTML = `
                ❌ <strong>Fecha no permitida</strong><br>
                No se permiten reservas los <strong>${dia}s</strong>. 
                Selecciona otro día (lunes, miércoles, viernes, sábado o domingo).
            `;
        } else {
            advertencia.style.display = 'block';
            advertencia.style.background = '#dcfce7';
            advertencia.style.borderLeft = '4px solid #16a34a';
            advertencia.style.color = '#166534';
            advertencia.innerHTML = `✅ <strong>Fecha válida</strong> - ${getNombreDia(fecha)}`;
            
            // Desaparecer después de 3 segundos
            setTimeout(() => {
                if (advertencia.style.display !== 'none' && !esDiasBloqueados(fecha)) {
                    advertencia.style.display = 'none';
                }
            }, 3000);
        }
    });
    
    // Agregar validación en el submit del formulario
    const form = document.getElementById('nueva-reserva-form');
    form.addEventListener('submit', (e) => {
        const fecha = fechaInput.value;
        
        if (fecha && esDiasBloqueados(fecha)) {
            e.preventDefault();
            alert('❌ No se permiten reservas los martes ni jueves. Por favor selecciona otra fecha.');
            fechaInput.focus();
        }
    });
});

// Agregar estilos CSS globales
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);
