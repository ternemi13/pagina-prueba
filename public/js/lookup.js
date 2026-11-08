(function () {
  'use strict';

  const api = window.BarberiaApi;
  const els = {
    form: document.getElementById('lookup-form'),
    submit: document.getElementById('lookup-submit'),
    error: document.getElementById('lookup-error'),
    empty: document.getElementById('lookup-empty'),
    result: document.getElementById('lookup-result'),
    code: document.getElementById('result-code'),
    status: document.getElementById('result-status'),
    body: document.getElementById('result-body'),
    actions: document.getElementById('result-actions'),
    cancelToggle: document.getElementById('cancel-toggle'),
    cancelForm: document.getElementById('cancel-form'),
    cancelSubmit: document.getElementById('cancel-submit'),
    cancelClose: document.getElementById('cancel-close'),
    cancelError: document.getElementById('cancel-error')
  };

  const state = {
    appointment: null,
    phone: '',
    looking: false,
    cancelling: false
  };

  function showError(target, message) {
    target.textContent = message;
    target.hidden = false;
  }

  function clearError(target) {
    target.hidden = true;
    target.textContent = '';
  }

  function renderRows(appointment) {
    const rows = [
      ['Servicio', appointment.service_name],
      ['Barbero', appointment.barber_name],
      ['Inicio', api.formatDateTime(appointment.start_datetime)],
      ['Fin', api.formatDateTime(appointment.end_datetime)],
      ['Precio', api.formatCurrency(appointment.price)],
      ['Método de pago', appointment.payment_method_label],
      ['Estado del pago', appointment.payment_status_label],
      ['Cliente', appointment.customer_name],
      ['Teléfono', appointment.customer_phone],
      ['Email', appointment.customer_email || '—'],
      ['Notas', appointment.notes || '—']
    ];

    if (appointment.status === 'cancelled' && appointment.cancel_reason) {
      rows.push(['Motivo de cancelación', appointment.cancel_reason]);
    }
    if (appointment.status === 'confirmed' && !appointment.can_cancel) {
      rows.push([
        'Cancelación online',
        `Ya no está disponible. Debe ser con al menos ${appointment.cancel_min_hours} horas de anticipación.`
      ]);
    }

    return rows
      .map(
        ([label, value]) =>
          `<div class="detail-row"><span>${api.escapeHtml(label)}</span><strong>${api.escapeHtml(
            value
          )}</strong></div>`
      )
      .join('');
  }

  function renderAppointment(appointment) {
    state.appointment = appointment;
    els.empty.hidden = true;
    els.result.hidden = false;
    els.code.textContent = appointment.code;
    els.status.className = `badge badge--${appointment.status}`;
    els.status.textContent = appointment.status_label || appointment.status;
    els.body.innerHTML = renderRows(appointment);
    els.cancelToggle.hidden = !appointment.can_cancel;
    els.cancelForm.hidden = true;
    clearError(els.cancelError);
    els.actions.hidden = false;
  }

  async function performLookup() {
    if (state.looking) return;
    clearError(els.error);
    const code = String(els.form.code.value || '').trim().toUpperCase();
    const phone = String(els.form.phone.value || '').replace(/\D/g, '');
    if (!code) {
      showError(els.error, 'Escribe tu código de reserva.');
      els.form.code.focus();
      return;
    }
    if (phone.length !== 10) {
      showError(els.error, 'Escribe el teléfono de 10 dígitos con el que reservaste.');
      els.form.phone.focus();
      return;
    }

    state.looking = true;
    state.phone = phone;
    api.setBusy(els.submit, true, 'Buscando…');
    try {
      const data = await api.get(
        `/api/public/appointments/lookup?code=${encodeURIComponent(
          code
        )}&phone=${encodeURIComponent(phone)}`
      );
      renderAppointment(data.appointment);
    } catch (error) {
      state.appointment = null;
      els.result.hidden = true;
      els.empty.hidden = false;
      showError(els.error, error.message);
    } finally {
      state.looking = false;
      api.setBusy(els.submit, false);
    }
  }

  async function cancelAppointment(event) {
    event.preventDefault();
    if (!state.appointment || state.cancelling) return;
    clearError(els.cancelError);
    const reason = String(els.cancelForm.reason.value || '').trim();

    state.cancelling = true;
    api.setBusy(els.cancelSubmit, true, 'Cancelando…');
    try {
      const data = await api.post(
        `/api/public/appointments/${encodeURIComponent(state.appointment.code)}/cancel`,
        { phone: state.phone, reason: reason || null }
      );
      renderAppointment(data.appointment);
      api.showToast('Tu cita fue cancelada.', 'success');
    } catch (error) {
      showError(els.cancelError, error.message);
    } finally {
      state.cancelling = false;
      api.setBusy(els.cancelSubmit, false);
    }
  }

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    performLookup();
  });

  els.cancelToggle.addEventListener('click', () => {
    els.cancelForm.hidden = false;
    els.cancelToggle.hidden = true;
    els.cancelForm.reason.focus();
  });

  els.cancelClose.addEventListener('click', () => {
    els.cancelForm.hidden = true;
    els.cancelToggle.hidden = false;
  });

  els.cancelForm.addEventListener('submit', cancelAppointment);

  async function init() {
    try {
      await api.fetchCsrfToken();
    } catch (error) {
      showError(els.error, 'No se pudo preparar la página. Recarga e inténtalo de nuevo.');
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const phone = params.get('phone');
    if (code) els.form.code.value = code;
    if (phone) els.form.phone.value = phone;
    if (code && phone) {
      performLookup();
    }
  }

  init();
})();
