document.addEventListener('DOMContentLoaded', () => {

    // Toggle ver/ocultar contraseña
    document.querySelectorAll('.toggle-password').forEach(eye => {
        eye.addEventListener('click', () => {
            const inputId = eye.getAttribute('data-target');
            const input = document.getElementById(inputId);
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

    const signUpContainer = document.querySelector('.sign-up-container');
    const signInContainer = document.querySelector('.sign-in-container');
    const okAccountLinks  = document.querySelectorAll('.ok-account');
    const noAccountLinks  = document.querySelectorAll('.no-account');
    const notifyCheck     = document.querySelector('.check_notify');
    const notifyError     = document.querySelector('.error_notify');

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

    if (window.location.protocol === 'file:') {
        showError('ERROR: Abre con http://localhost o 127.0.0.1');
        document.querySelectorAll('form').forEach(f => f.addEventListener('submit', e => e.preventDefault()));
        return;
    }

    // Alternar entre login y registro
    okAccountLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            signUpContainer.style.display = 'none';
            signInContainer.style.display = 'block';
        });
    });

    noAccountLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            signInContainer.style.display = 'none';
            signUpContainer.style.display = 'block';
        });
    });

    // ============================================
    // RECUPERAR CONTRASEÑA — flujo de dos pasos
    // ============================================
    const loginFormEl = document.querySelector('.formulario');
    const step1       = document.getElementById('forgot-step1');
    const step2       = document.getElementById('forgot-step2');

    function setStepMsg(stepEl, msg, tipo) {
        const el = stepEl.querySelector('.forgot-inline-msg');
        if (!el) return;
        el.textContent = msg;
        el.className   = 'forgot-inline-msg ' + tipo;
    }

    function hideForgot() {
        step1.classList.remove('active');
        step2.classList.remove('active');
        loginFormEl.style.display = '';
        document.getElementById('forgot-email').value        = '';
        document.getElementById('forgot-codigo').value       = '';
        document.getElementById('forgot-new-pass').value     = '';
        document.getElementById('forgot-confirm-pass').value = '';
        setStepMsg(step1, '', '');
        setStepMsg(step2, '', '');
    }

    function showStep1() {
        step2.classList.remove('active');
        step1.classList.add('active');
        loginFormEl.style.display = 'none';
    }

    function showStep2(email) {
        step1.classList.remove('active');
        step2.classList.add('active');
        document.getElementById('forgot-email-label').textContent = email;
        document.getElementById('forgot-codigo').value = '';
        setStepMsg(step2, '', '');
    }

    // Abrir paso 1 al hacer clic en "¿Olvidaste tu contraseña?"
    const forgotLink = document.querySelector('.forgot-password');
    if (forgotLink) {
        forgotLink.addEventListener('click', e => {
            e.preventDefault();
            // Pre-rellenar email si ya lo habían escrito
            const typed = document.getElementById('email').value.trim();
            if (typed) document.getElementById('forgot-email').value = typed;
            showStep1();
        });
    }

    // Cancelar → volver al login
    document.getElementById('btn-forgot-cancel')?.addEventListener('click', hideForgot);

    // Volver al paso 1 desde paso 2
    document.getElementById('btn-forgot-back')?.addEventListener('click', showStep1);

    // Paso 1: enviar código
    async function enviarCodigo() {
        const email = document.getElementById('forgot-email').value.trim();
        if (!email) { setStepMsg(step1, 'Ingresa tu correo electrónico.', 'msg-error'); return; }

        const btn = document.getElementById('btn-enviar-codigo');
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        setStepMsg(step1, '', '');

        try {
            const res  = await fetch('api/enviar_codigo.php', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email })
            });
            const data = await res.json();

            if (data.success) {
                showStep2(email);
                setStepMsg(step2, data.message, 'msg-ok');
            } else {
                setStepMsg(step1, data.message, 'msg-error');
            }
        } catch {
            setStepMsg(step1, 'Error de conexión. Intenta de nuevo.', 'msg-error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enviar código';
        }
    }

    document.getElementById('btn-enviar-codigo')?.addEventListener('click', enviarCodigo);
    document.getElementById('btn-reenviar-codigo')?.addEventListener('click', e => {
        e.preventDefault();
        enviarCodigo();
    });

    // Solo dígitos en el campo código
    document.getElementById('forgot-codigo')?.addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });

    // Paso 2: verificar código y cambiar contraseña
    document.getElementById('btn-forgot-submit')?.addEventListener('click', async () => {
        const email       = document.getElementById('forgot-email').value.trim();
        const codigo      = document.getElementById('forgot-codigo').value.trim();
        const newPass     = document.getElementById('forgot-new-pass').value;
        const confirmPass = document.getElementById('forgot-confirm-pass').value;

        if (!codigo || codigo.length !== 6) {
            setStepMsg(step2, 'Ingresa el código de 6 dígitos.', 'msg-error'); return;
        }
        if (!newPass) {
            setStepMsg(step2, 'Ingresa la nueva contraseña.', 'msg-error'); return;
        }
        if (newPass.length < 8) {
            setStepMsg(step2, 'La contraseña debe tener al menos 8 caracteres.', 'msg-error'); return;
        }
        if (newPass !== confirmPass) {
            setStepMsg(step2, 'Las contraseñas no coinciden.', 'msg-error'); return;
        }

        const btn = document.getElementById('btn-forgot-submit');
        btn.disabled = true;
        btn.textContent = 'Verificando...';
        setStepMsg(step2, '', '');

        try {
            const res  = await fetch('api/recuperar_password.php', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, codigo, new_password: newPass, confirm_password: confirmPass })
            });
            const data = await res.json();

            if (data.success) {
                setStepMsg(step2, data.message, 'msg-ok');
                setTimeout(() => {
                    hideForgot();
                    showSuccess('Contraseña actualizada. Ya puedes iniciar sesión.');
                }, 1800);
            } else {
                setStepMsg(step2, data.message, 'msg-error');
            }
        } catch {
            setStepMsg(step2, 'Error de conexión. Intenta de nuevo.', 'msg-error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Cambiar contraseña';
        }
    });

    // ============================================
    // BLOQUEO DE CUENTA (brute-force)
    // ============================================
    function lockLoginForm(seconds) {
        const emailInput = document.getElementById('email');
        const passInput  = document.getElementById('password');
        const submitBtn  = document.querySelector('.formulario .submit');

        emailInput.disabled = true;
        passInput.disabled  = true;
        submitBtn.disabled  = true;
        submitBtn.value     = 'BLOQUEADO';

        let countdown = seconds;
        showError('Cuenta bloqueada. Espera ' + countdown + ' segundos.');

        const interval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                notifyError.textContent = 'Cuenta bloqueada. Espera ' + countdown + ' segundos.';
                notifyError.classList.add('active');
            } else {
                clearInterval(interval);
                emailInput.disabled = false;
                passInput.disabled  = false;
                submitBtn.disabled  = false;
                submitBtn.value     = 'Iniciar sesión';
                notifyError.classList.remove('active');
            }
        }, 1000);
    }

    // ============================================
    // LOGIN
    // ============================================
    const loginForm = document.querySelector('.formulario');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email    = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email || !password) {
                showError('Ingresa tu correo y contraseña.');
                return;
            }

            try {
                const res = await fetch('api/login.php', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ email, password })
                });

                if (!res.ok) {
                    showError(`Error en el servidor (${res.status}). Revisa la consola.`);
                    return;
                }

                const data = await res.json();
                const loginErrEl = document.getElementById('login-error-msg');

                if (data.success) {
                    if (loginErrEl) loginErrEl.style.display = 'none';
                    showSuccess('¡Inicio de sesión exitoso!');
                    setTimeout(() => {
                        window.location.href = data.redirect || 'dashboard.php';
                    }, 700);
                } else if (data.locked) {
                    if (loginErrEl) {
                        loginErrEl.textContent = data.message;
                        loginErrEl.style.display = 'block';
                    }
                    lockLoginForm(data.remaining || 5);
                } else {
                    if (loginErrEl) {
                        loginErrEl.textContent = data.message;
                        loginErrEl.style.display = 'block';
                    }
                    showError(data.message || 'Credenciales incorrectas.');
                }
            } catch (err) {
                showError('Error de red. Verifica que el servidor esté corriendo.');
            }
        });
    }

    // ============================================
    // REGISTRO
    // ============================================
    const regForm = document.querySelector('.formulario2');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre             = document.getElementById('name').value.trim();
            const email              = document.getElementById('email2').value.trim();
            const password           = document.getElementById('password2').value;
            const confirmPassword    = document.getElementById('confirm_password').value;
            const rol                = document.getElementById('rol').value.trim();
            const codigoInvitacion   = document.getElementById('codigo_invitacion').value.trim().toUpperCase();

            if (!nombre || !email || !password || !confirmPassword || !rol) {
                showError('Todos los campos son obligatorios.');
                return;
            }

            if (!codigoInvitacion) {
                showError('Ingresa tu código de invitación.');
                return;
            }

            if (password !== confirmPassword) {
                showError('Las contraseñas no coinciden.');
                return;
            }

            if (password.length < 8) {
                showError('La contraseña debe tener al menos 8 caracteres.');
                return;
            }

            try {
                const res = await fetch('api/registro.php', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ nombre, email, password, confirm_password: confirmPassword, rol, codigo_invitacion: codigoInvitacion })
                });
                const data = await res.json();

                if (data.success) {
                    showSuccess(data.message || '¡Registro exitoso! Ya puedes iniciar sesión.');
                    regForm.reset();
                    setTimeout(() => {
                        signInContainer.style.display = 'none';
                        signUpContainer.style.display = 'block';
                    }, 1500);
                } else {
                    showError(data.message || 'Error al registrar. Intenta de nuevo.');
                }
            } catch (err) {
                showError('Error de red o respuesta inválida del servidor.');
            }
        });
    }
});
