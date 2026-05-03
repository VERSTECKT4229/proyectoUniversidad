document.addEventListener('DOMContentLoaded', () => {

    // Ojito para ver/ocultar contraseña
    document.querySelectorAll('.toggle-password').forEach(eye => {
        eye.addEventListener('click', () => {
            const inputId = eye.getAttribute('data-target');
            const input = document.getElementById(inputId);
            if (input.type === 'password') {
                input.type = 'text';
                eye.textContent = '🙈';
            } else {
                input.type = 'password';
                eye.textContent = '👁️';
            }
        });
    });

    const signUpContainer = document.querySelector('.sign-up-container');
    const signInContainer = document.querySelector('.sign-in-container');
    const okAccountLink = document.querySelector('.ok-account');
    const noAccountLink = document.querySelector('.no-account');
    const notifyCheck = document.querySelector('.check_notify');
    const notifyError = document.querySelector('.error_notify');

    function showNotify(element) {
        element.classList.add('active');
        setTimeout(() => element.classList.remove('active'), 5000);
    }

    function showError(msg) {
        notifyError.textContent = msg;
        showNotify(notifyError);
    }

    function showSuccess(msg) {
        notifyCheck.textContent = msg;
        showNotify(notifyCheck);
    }

    async function loadRuntimeLinks() {
        try {
            const res = await fetch('api/runtime_links.php');
            const data = await res.json();
            if (!data.success) return;

            const localEl = document.getElementById('runtime-local');
            const publicEl = document.getElementById('runtime-public');

            if (localEl) {
                localEl.textContent = 'Local: ' + (data.local_base || '-');
            }
            if (publicEl) {
                publicEl.textContent = 'Cloudflare: ' + (data.public_base || '-');
            }
        } catch (e) {
            // sin bloqueo de UX
        }
    }

    if (window.location.protocol === 'file:') {
        showError('ERROR: Abre con http://localhost o 127.0.0.1');
        document.querySelectorAll('form').forEach(f => f.addEventListener('submit', e => e.preventDefault()));
        return;
    }

    loadRuntimeLinks();

    if (okAccountLink) {
        okAccountLink.addEventListener('click', (e) => {
            e.preventDefault();
            signUpContainer.style.display = 'none';
            signInContainer.style.display = 'block';
        });
    }

    if (noAccountLink) {
        noAccountLink.addEventListener('click', (e) => {
            e.preventDefault();
            signInContainer.style.display = 'none';
            signUpContainer.style.display = 'block';
        });
    }

    // Función para bloquear/deshabilitar formulario de login
    function lockLoginForm(seconds) {
        const emailInput = document.getElementById('email');
        const passInput = document.getElementById('password');
        const submitBtn = document.querySelector('.formulario .submit');

        emailInput.disabled = true;
        passInput.disabled = true;
        submitBtn.disabled = true;
        submitBtn.value = 'BLOQUEADO';

        let countdown = seconds;
        showError('tu cuenta ha sido bloqueada espere ' + countdown + ' segundos');

        const interval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                notifyError.textContent = 'tu cuenta ha sido bloqueada espere ' + countdown + ' segundos';
                notifyError.classList.add('active');
            } else {
                clearInterval(interval);
                // Desbloquear formulario
                emailInput.disabled = false;
                passInput.disabled = false;
                submitBtn.disabled = false;
                submitBtn.value = 'login';
                notifyError.classList.remove('active');
            }
        }, 1000);
    }

    // Manejador para Olvidé mi contraseña (Task 1)
    // Buscamos por clase o buscamos el link que tenga texto relacionado a recuperar
    const forgotPasswordLink = document.querySelector('.forgot-password') || Array.from(document.querySelectorAll('a')).find(el => el.textContent.toLowerCase().includes('olvidaste'));
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('email');
            let email = emailInput.value.trim();

            if (!email) {
                email = prompt('CAMBIAR CONTRASEÑA: Ingresa tu correo electrónico:');
                if (!email) return;
            }

            const newPass = prompt('Escribe tu nueva contraseña (mínimo 8 caracteres):');
            if (!newPass) return;

            const confirmPass = prompt('Confirma la nueva contraseña escribiéndola de nuevo:');
            if (!confirmPass) return;

            if (newPass !== confirmPass) {
                showError('Las contraseñas no coinciden');
                return;
            }

            try {
                const res = await fetch('api/recuperar_password.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email: email.trim(),
                        new_password: newPass,
                        confirm_password: confirmPass
                    })
                });
                const data = await res.json();
                if (data.success) {
                    showSuccess(data.message);
                } else {
                    showError(data.message);
                }
            } catch (err) {
                showError('Error de conexión al intentar recuperar');
            }
        });
    }

    const loginForm = document.querySelector('.formulario');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email || !password) {
                showError('Faltan datos');
                return;
            }

            try {
                const res = await fetch('api/login.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                if (!res.ok) {
                    console.error('Server error response:', await res.text());
                    showError(`Error en servidor (${res.status}). Revisa la consola.`);
                    return;
                }

                const data = await res.json();
                if (data.success) {
                    showSuccess('LOGIN CORRECTO');
                    setTimeout(() => {
                        window.location.href = data.redirect || 'dashboard.php';
                    }, 700);
                } else if (data.locked) {
                    lockLoginForm(data.remaining || 5);
                } else {
                    showError(data.message || 'Error');
                }
            } catch (err) {
                console.error('Fetch error:', err);
                showError('Error de red: No se pudo conectar con el servidor. Verifica que XAMPP esté corriendo.');
            }
        });
    }

    const regForm = document.querySelector('.formulario2');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('name').value.trim();
            const email = document.getElementById('email2').value.trim();
            const password = document.getElementById('password2').value;
            const confirmPassword = document.getElementById('confirm_password').value;
            const rol = document.getElementById('rol').value.trim();

            if (!nombre || !email || !password || !confirmPassword || !rol) {
                showError('Todos los campos son obligatorios');
                return;
            }

            if (password !== confirmPassword) {
                showError('Las contraseñas no coinciden');
                return;
            }

            try {
                const res = await fetch('api/registro.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, email, password, confirm_password: confirmPassword, rol })
                });
                const data = await res.json();
                if (data.success) {
                    showSuccess(data.message || 'Registro exitoso');
                    regForm.reset();
                    // Corregido: Mostrar el contenedor de Login al tener éxito
                    setTimeout(() => {
                        signUpContainer.style.display = 'none';
                        signInContainer.style.display = 'block';
                    }, 1500);
                } else {
                    showError(data.message || 'Error');
                }
            } catch (err) {
                showError('Error de red o respuesta inválida del servidor');
            }
        });
    }
});
