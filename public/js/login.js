(function () {
  'use strict';

  const api = window.BarberiaApi;
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const submit = document.getElementById('login-submit');

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function safeNext(value) {
    if (typeof value !== 'string') return '/admin';
    if (!value.startsWith('/') || value.startsWith('//')) return '/admin';
    return value;
  }

  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Ocultar' : 'Ver';
      button.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearError();

      const username = form.username.value.trim();
      const password = form.password.value;
      if (username.length < 3) {
        showError('Escribe tu usuario.');
        form.username.focus();
        return;
      }
      if (password.length < 8) {
        showError('La contraseña debe tener al menos 8 caracteres.');
        form.password.focus();
        return;
      }

      api.setBusy(submit, true, 'Entrando…');
      try {
        await api.post('/api/auth/login', { username, password });
        window.location.assign(safeNext(form.dataset.next));
      } catch (error) {
        showError(error.message || 'No se pudo iniciar sesión.');
        api.setBusy(submit, false);
        form.password.focus();
        form.password.select();
      }
    });
  }

  api.fetchCsrfToken().catch(() => {
    showError('No se pudo preparar el formulario. Recarga la página.');
  });
})();
