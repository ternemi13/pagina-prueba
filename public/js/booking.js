(function () {
  'use strict';

  const api = window.BarberiaApi;
  const els = {
    loading: document.getElementById('booking-loading'),
    error: document.getElementById('booking-error'),
    form: document.getElementById('booking-form'),
    progress: document.getElementById('booking-progress'),
    summary: document.getElementById('booking-summary'),
    terms: document.getElementById('booking-terms'),
    stepEyebrow: document.getElementById('step-eyebrow'),
    stepTitle: document.getElementById('step-title'),
    stepSubtitle: document.getElementById('step-subtitle'),
    serviceChoices: document.getElementById('service-choices'),
    barberChoices: document.getElementById('barber-choices'),
    calendarMonth: document.getElementById('calendar-month'),
    calendarGrid: document.getElementById('calendar-grid'),
    calendarPrev: document.getElementById('calendar-prev'),
    calendarNext: document.getElementById('calendar-next'),
    timeSection: document.getElementById('time-section'),
    timeGrid: document.getElementById('time-grid'),
    timeEmpty: document.getElementById('time-empty'),
    selectedDateLabel: document.getElementById('selected-date-label'),
    toStep4: document.getElementById('to-step-4'),
    paymentOptions: document.getElementById('payment-options'),
    transferBox: document.getElementById('transfer-box'),
    confirmSummary: document.getElementById('confirm-summary'),
    submit: document.getElementById('booking-submit'),
    success: document.getElementById('booking-success'),
    successMessage: document.getElementById('success-message'),
    successCode: document.getElementById('success-code'),
    successDetails: document.getElementById('success-details'),
    successConsulta: document.getElementById('success-consulta'),
    successNew: document.getElementById('success-new')
  };

  const STEP_COPY = {
    1: ['Paso 1 de 4', 'Elige tu servicio', 'Selecciona el servicio que quieres recibir.'],
    2: ['Paso 2 de 4', 'Elige a tu barbero', 'Puedes elegir un barbero en particular o dejar que asignemos al primero disponible.'],
    3: ['Paso 3 de 4', 'Elige fecha y hora', 'Los días sin disponibilidad aparecen deshabilitados.'],
    4: ['Paso 4 de 4', 'Confirma tus datos', 'Revisa la información y déjanos tus datos de contacto.']
  };

  const state = {
    settings: null,
    services: [],
    barbers: [],
    selectedService: null,
    selectedBarber: null,
    month: api.monthBogota(),
    days: [],
    selectedDate: null,
    selectedTime: null,
    step: 1,
    paymentMethod: null,
    submitting: false
  };

  function showError(message) {
    els.error.textContent = message;
    els.error.hidden = false;
  }

  function clearError() {
    els.error.hidden = true;
    els.error.textContent = '';
  }

  function setLoading(visible, text) {
    els.loading.hidden = !visible;
    if (visible && text) {
      els.loading.querySelector('span:last-child').textContent = text;
    }
  }

  function serviceById(id) {
    return state.services.find((service) => Number(service.id) === Number(id)) || null;
  }

  function barberById(id) {
    return state.barbers.find((barber) => Number(barber.id) === Number(id)) || null;
  }

  function barberLabel() {
    if (!state.selectedBarber) return 'Sin elegir';
    return state.selectedBarber.name;
  }

  function renderSummary() {
    if (!els.summary) return;
    const service = state.selectedService;
    const total = service ? api.formatCurrency(service.price) : '—';
    const date = state.selectedDate ? api.formatDateLong(state.selectedDate) : 'Sin elegir';
    const time = state.selectedTime || 'Sin elegir';
    els.summary.innerHTML = [
      ['Servicio', service ? service.name : 'Sin elegir'],
      ['Barbero', barberLabel()],
      ['Fecha', date],
      ['Hora', time],
      ['Total', total]
    ]
      .map(
        ([label, value]) =>
          `<div class="summary__row"><span>${api.escapeHtml(label)}</span><strong>${api.escapeHtml(
            value
          )}</strong></div>`
      )
      .join('');
  }

  function renderConfirmSummary() {
    if (!els.confirmSummary) return;
    const service = state.selectedService;
    const method = state.settings
      ? state.settings.paymentMethods.find((item) => item.value === state.paymentMethod)
      : null;
    const rows = [
      ['Servicio', service ? service.name : '—'],
      ['Duración', service ? `${service.duration_minutes} minutos` : '—'],
      ['Barbero', barberLabel()],
      ['Fecha', state.selectedDate ? api.formatDateLong(state.selectedDate) : '—'],
      ['Hora', state.selectedTime || '—'],
      ['Pago', method ? method.label : '—'],
      ['Total', service ? api.formatCurrency(service.price) : '—']
    ];
    els.confirmSummary.innerHTML = rows
      .map(
        ([label, value]) =>
          `<div class="summary__row"><span>${api.escapeHtml(label)}</span><strong>${api.escapeHtml(
            value
          )}</strong></div>`
      )
      .join('');
  }

  function setStep(step) {
    state.step = step;
    document.querySelectorAll('.step').forEach((section) => {
      section.classList.toggle('is-active', Number(section.dataset.step) === step);
    });
    if (els.progress) {
      els.progress.querySelectorAll('[data-progress]').forEach((item) => {
        const value = Number(item.dataset.progress);
        item.classList.toggle('is-active', value === step);
        item.classList.toggle('is-done', value < step);
      });
    }
    const copy = STEP_COPY[step];
    if (copy) {
      els.stepEyebrow.textContent = copy[0];
      els.stepTitle.textContent = copy[1];
      els.stepSubtitle.textContent = copy[2];
    }
    if (step === 4) {
      renderConfirmSummary();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderServices() {
    if (state.services.length === 0) {
      els.serviceChoices.innerHTML = '<p class="empty-state">Todavía no hay servicios disponibles.</p>';
      return;
    }
    els.serviceChoices.innerHTML = state.services
      .map(
        (service) => `
        <button type="button" class="choice-card" data-service-id="${Number(service.id)}">
          <strong>${api.escapeHtml(service.name)}</strong>
          <span>${api.escapeHtml(service.description || 'Servicio profesional de barbería.')}</span>
          <span class="choice-card__meta">
            <span>${Number(service.duration_minutes)} min</span>
            <span>${api.escapeHtml(api.formatCurrency(service.price))}</span>
          </span>
        </button>`
      )
      .join('');
  }

  function renderBarbers() {
    if (state.barbers.length === 0) {
      els.barberChoices.innerHTML = '<p class="empty-state">No hay barberos disponibles para este servicio.</p>';
      return;
    }
    const anySelected =
      state.selectedBarber && state.selectedBarber.id === 'any' ? ' is-selected' : '';
    const cards = [
      `<button type="button" class="choice-card choice-card--barber${anySelected}" data-barber-id="any">
        <img src="/img/barber-placeholder.svg" alt="" loading="lazy">
        <span><strong>Cualquier barbero</strong><span>Asignamos al primero disponible.</span></span>
      </button>`
    ];

    for (const barber of state.barbers) {
      const selected =
        state.selectedBarber && Number(state.selectedBarber.id) === Number(barber.id)
          ? ' is-selected'
          : '';
      cards.push(
        `<button type="button" class="choice-card choice-card--barber${selected}" data-barber-id="${Number(
          barber.id
        )}">
          <img src="${api.escapeHtml(barber.photo_url || '/img/barber-placeholder.svg')}" alt="" loading="lazy">
          <span><strong>${api.escapeHtml(barber.name)}</strong><span>${api.escapeHtml(
          barber.bio || 'Barbero profesional.'
        )}</span></span>
        </button>`
      );
    }
    els.barberChoices.innerHTML = cards.join('');
  }

  function markSelected(container, attribute, value) {
    if (!container) return;
    container.querySelectorAll(`[${attribute}]`).forEach((item) => {
      const itemValue = item.getAttribute(attribute);
      const selected = String(itemValue) === String(value);
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  async function loadBarbers(serviceId) {
    const data = await api.get(`/api/public/barbers?service_id=${encodeURIComponent(serviceId)}`);
    state.barbers = data.barbers || [];
    renderBarbers();
  }

  async function selectService(serviceId, advance) {
    const service = serviceById(serviceId);
    if (!service) return;
    state.selectedService = service;
    state.selectedBarber = null;
    state.selectedDate = null;
    state.selectedTime = null;
    state.month = api.monthBogota();
    markSelected(els.serviceChoices, 'data-service-id', service.id);
    renderSummary();
    clearError();
    setLoading(true, 'Cargando barberos…');
    try {
      await loadBarbers(service.id);
      setLoading(false);
      if (advance !== false) setStep(2);
    } catch (error) {
      setLoading(false);
      showError(error.message);
    }
  }

  async function selectBarber(barberId, advance) {
    const value = String(barberId);
    if (value === 'any') {
      state.selectedBarber = { id: 'any', name: 'Cualquier barbero' };
    } else {
      const barber = barberById(value);
      if (!barber) return;
      state.selectedBarber = barber;
    }
    state.selectedDate = null;
    state.selectedTime = null;
    markSelected(els.barberChoices, 'data-barber-id', value);
    renderSummary();
    clearError();
    if (advance !== false) {
      setStep(3);
      await loadMonth(state.month);
    }
  }

  function renderCalendar() {
    const parts = state.month.split('-').map(Number);
    const year = parts[0];
    const month = parts[1];
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const offset = (firstDay + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const byDate = new Map(state.days.map((day) => [day.date, day]));
    const today = api.todayBogota();

    const cells = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(
      (day) => `<div class="calendar__weekday">${day}</div>`
    );

    for (let index = 0; index < offset; index += 1) {
      cells.push('<div class="calendar__day is-empty" aria-hidden="true"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const info = byDate.get(date);
      const disabled = !info || !info.available;
      const selected = state.selectedDate === date ? ' is-selected' : '';
      const isToday = date === today ? ' data-today="true"' : '';
      cells.push(
        `<button type="button" class="calendar__day${selected}" data-date="${date}"${isToday} ${
          disabled ? 'disabled' : ''
        } aria-label="${api.escapeHtml(api.formatDateLong(date))}${disabled ? ' sin disponibilidad' : ''}">${day}</button>`
      );
    }

    els.calendarMonth.textContent = api.monthLabel(state.month);
    els.calendarGrid.innerHTML = cells.join('');
  }

  async function loadMonth(month) {
    if (!state.selectedService || !state.selectedBarber) return;
    clearError();
    try {
      const data = await api.get(
        `/api/public/availability/days?service_id=${encodeURIComponent(
          state.selectedService.id
        )}&barber_id=${encodeURIComponent(state.selectedBarber.id)}&month=${encodeURIComponent(month)}`
      );
      state.month = data.month || month;
      state.days = data.days || [];
      renderCalendar();
    } catch (error) {
      showError(error.message);
    }
  }

  async function loadTimes(date) {
    clearError();
    els.timeSection.hidden = false;
    els.timeEmpty.hidden = true;
    els.timeGrid.innerHTML = '<div class="booking-loading"><span class="spinner"></span><span>Cargando horas…</span></div>';
    els.toStep4.disabled = true;
    try {
      const data = await api.get(
        `/api/public/availability?service_id=${encodeURIComponent(
          state.selectedService.id
        )}&barber_id=${encodeURIComponent(state.selectedBarber.id)}&date=${encodeURIComponent(date)}`
      );
      const times = data.times || [];
      els.selectedDateLabel.textContent = api.formatDateLong(date);
      els.timeGrid.innerHTML = times
        .map(
          (time) =>
            `<button type="button" class="time-btn${
              state.selectedTime === time ? ' is-selected' : ''
            }" data-time="${api.escapeHtml(time)}">${api.escapeHtml(time)}</button>`
        )
        .join('');
      els.timeEmpty.hidden = times.length > 0;
      els.toStep4.disabled = !state.selectedTime;
    } catch (error) {
      els.timeGrid.innerHTML = '';
      showError(error.message);
    }
  }

  async function selectDate(date) {
    state.selectedDate = date;
    state.selectedTime = null;
    renderCalendar();
    renderSummary();
    await loadTimes(date);
  }

  function selectTime(time) {
    state.selectedTime = time;
    els.timeGrid.querySelectorAll('[data-time]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.time === time);
    });
    els.toStep4.disabled = false;
    renderSummary();
  }

  function renderPaymentOptions() {
    const methods = state.settings ? state.settings.paymentMethods : [];
    if (methods.length === 0) {
      els.paymentOptions.innerHTML = '<p class="empty-state">No hay métodos de pago configurados.</p>';
      return;
    }
    if (!state.paymentMethod || !methods.some((method) => method.value === state.paymentMethod)) {
      state.paymentMethod = methods[0].value;
    }
    els.paymentOptions.innerHTML = methods
      .map(
        (method) => `
        <label class="payment-option">
          <input type="radio" name="payment_method" value="${api.escapeHtml(method.value)}" ${
          method.value === state.paymentMethod ? 'checked' : ''
        }>
          <span><strong>${api.escapeHtml(method.label)}</strong><small>${
          method.value === 'bank_transfer'
            ? 'Transfiere antes de la cita y envía el comprobante.'
            : 'Paga directamente en el local al terminar el servicio.'
        }</small></span>
        </label>`
      )
      .join('');
    renderTransferBox();
  }

  function renderTransferBox() {
    if (!els.transferBox) return;
    const transfer = state.settings ? state.settings.transfer : null;
    if (state.paymentMethod !== 'bank_transfer' || !transfer) {
      els.transferBox.hidden = true;
      els.transferBox.innerHTML = '';
      return;
    }
    const rows = [
      ['Banco', transfer.bankName],
      ['Tipo de cuenta', transfer.accountType],
      ['Cuenta', transfer.accountNumber],
      ['Titular', transfer.accountHolder],
      ['Nequi', transfer.nequi],
      ['Daviplata', transfer.daviplata]
    ].filter(([, value]) => value);
    els.transferBox.innerHTML = `
      <strong>Datos para transferir</strong>
      <dl>${rows
        .map(
          ([label, value]) =>
            `<dt>${api.escapeHtml(label)}</dt><dd>${api.escapeHtml(value)}</dd>`
        )
        .join('')}</dl>
      <p>${api.escapeHtml(transfer.instructions || '')}</p>`;
    els.transferBox.hidden = false;
  }

  function resetFormForNewBooking() {
    state.selectedService = null;
    state.selectedBarber = null;
    state.selectedDate = null;
    state.selectedTime = null;
    state.month = api.monthBogota();
    state.paymentMethod = null;
    state.submitting = false;
    els.form.reset();
    els.success.hidden = true;
    els.form.hidden = false;
    els.loading.hidden = true;
    els.serviceChoices.querySelectorAll('.choice-card').forEach((card) => {
      card.classList.remove('is-selected');
    });
    els.barberChoices.innerHTML = '';
    els.calendarGrid.innerHTML = '';
    els.timeSection.hidden = true;
    els.timeGrid.innerHTML = '';
    renderSummary();
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showSuccess(appointment) {
    els.form.hidden = true;
    els.loading.hidden = true;
    els.success.hidden = false;
    els.successMessage.textContent =
      (state.settings && state.settings.values.booking_success_message) ||
      'Tu cita quedó registrada. Guarda tu código para consultarla o cancelarla.';
    els.successCode.textContent = appointment.code;
    els.successDetails.innerHTML = [
      ['Servicio', appointment.service_name],
      ['Barbero', appointment.barber_name],
      ['Fecha', api.formatDateTime(appointment.start_datetime)],
      ['Total', api.formatCurrency(appointment.price)],
      ['Pago', appointment.payment_method_label]
    ]
      .map(
        ([label, value]) =>
          `<div class="summary__row"><span>${api.escapeHtml(label)}</span><strong>${api.escapeHtml(
            value
          )}</strong></div>`
      )
      .join('');
    els.successConsulta.href = `/consulta?code=${encodeURIComponent(
      appointment.code
    )}&phone=${encodeURIComponent(appointment.customer_phone || '')}`;
    if (els.progress) {
      els.progress.querySelectorAll('[data-progress]').forEach((item) => {
        item.classList.remove('is-active');
        item.classList.add('is-done');
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.submitting) return;
    clearError();

    const form = new FormData(els.form);
    const name = String(form.get('customer_name') || '').trim();
    const phone = String(form.get('customer_phone') || '').replace(/\D/g, '');
    const email = String(form.get('customer_email') || '').trim();
    const notes = String(form.get('notes') || '').trim();

    if (name.length < 2) {
      showError('Escribe tu nombre completo.');
      els.form.customer_name.focus();
      return;
    }
    if (phone.length !== 10) {
      showError('Escribe un teléfono colombiano de 10 dígitos.');
      els.form.customer_phone.focus();
      return;
    }
    if (!state.selectedService || !state.selectedDate || !state.selectedTime) {
      showError('Vuelve a elegir servicio, fecha y hora.');
      setStep(3);
      return;
    }

    state.submitting = true;
    api.setBusy(els.submit, true, 'Confirmando…');
    try {
      const data = await api.post('/api/public/appointments', {
        service_id: state.selectedService.id,
        barber_id: state.selectedBarber ? state.selectedBarber.id : 'any',
        date: state.selectedDate,
        time: state.selectedTime,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        notes: notes || null,
        payment_method: state.paymentMethod
      });
      showSuccess(data.appointment);
    } catch (error) {
      showError(error.message);
      if (error.status === 409) {
        state.selectedTime = null;
        els.toStep4.disabled = true;
        setStep(3);
        await loadTimes(state.selectedDate);
      }
    } finally {
      state.submitting = false;
      api.setBusy(els.submit, false);
    }
  }

  function bindEvents() {
    els.serviceChoices.addEventListener('click', (event) => {
      const card = event.target.closest('[data-service-id]');
      if (card) selectService(card.dataset.serviceId, true);
    });

    els.barberChoices.addEventListener('click', (event) => {
      const card = event.target.closest('[data-barber-id]');
      if (card) selectBarber(card.dataset.barberId, true);
    });

    els.calendarGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-date]');
      if (button && !button.disabled) selectDate(button.dataset.date);
    });

    els.timeGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-time]');
      if (button) selectTime(button.dataset.time);
    });

    els.calendarPrev.addEventListener('click', () => {
      state.month = api.addMonths(state.month, -1);
      loadMonth(state.month);
    });

    els.calendarNext.addEventListener('click', () => {
      state.month = api.addMonths(state.month, 1);
      loadMonth(state.month);
    });

    els.toStep4.addEventListener('click', () => {
      if (!state.selectedTime) return;
      renderPaymentOptions();
      setStep(4);
    });

    document.querySelectorAll('[data-back]').forEach((button) => {
      button.addEventListener('click', () => {
        setStep(Number(button.dataset.back));
      });
    });

    els.paymentOptions.addEventListener('change', (event) => {
      if (event.target.name === 'payment_method') {
        state.paymentMethod = event.target.value;
        renderTransferBox();
        renderConfirmSummary();
      }
    });

    els.form.addEventListener('submit', handleSubmit);
    els.successNew.addEventListener('click', resetFormForNewBooking);
  }

  async function init() {
    bindEvents();
    renderSummary();
    try {
      await api.fetchCsrfToken();
      const [settings, servicesData] = await Promise.all([
        api.get('/api/public/settings'),
        api.get('/api/public/services')
      ]);
      state.settings = settings;
      state.services = servicesData.services || [];
      els.terms.textContent = settings.values.booking_terms || els.terms.textContent;
      renderServices();
      renderPaymentOptions();
      setLoading(false);

      const params = new URLSearchParams(window.location.search);
      const requestedService = params.get('servicio');
      const requestedBarber = params.get('barbero');
      if (requestedService && serviceById(requestedService)) {
        await selectService(requestedService, false);
        if (requestedBarber) {
          const value = requestedBarber === 'any' ? 'any' : barberById(requestedBarber);
          if (value) {
            await selectBarber(value === 'any' ? 'any' : value.id, false);
            setStep(3);
            await loadMonth(state.month);
            return;
          }
        }
        setStep(2);
        return;
      }
      setStep(1);
    } catch (error) {
      setLoading(false);
      showError(error.message || 'No se pudieron cargar los datos para reservar.');
    }
  }

  init();
})();
