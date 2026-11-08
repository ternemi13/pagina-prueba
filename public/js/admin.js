(function () {
  'use strict';

  const api = window.BarberiaApi;

  const STATUS_LABELS = {
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No asistió'
  };
  const PAYMENT_STATUS_LABELS = {
    pending: 'Pendiente',
    paid: 'Pagado'
  };
  const PAYMENT_METHOD_LABELS = {
    cash_on_site: 'Pago en el local',
    bank_transfer: 'Transferencia'
  };
  const ROLE_LABELS = { admin: 'Administrador', barber: 'Barbero' };
  const GROUP_LABELS = {
    business: 'Negocio',
    texts: 'Textos del sitio',
    location: 'Ubicación',
    contact: 'Contacto',
    seo: 'SEO',
    design: 'Diseño',
    hours: 'Horarios',
    payments: 'Pagos',
    rules: 'Reglas de reserva'
  };
  const SECTION_META = {
    dashboard: ['Resumen', 'Citas y movimiento del día'],
    appointments: ['Citas', 'Filtra y gestiona las reservas'],
    calendar: ['Calendario', 'Vista mensual de citas y bloqueos'],
    barbers: ['Barberos', 'Equipo, servicios y horarios'],
    services: ['Servicios', 'Catálogo, precios y duración'],
    blocks: ['Bloqueos', 'Disponibilidad y ausencias'],
    settings: ['Configuración', 'Datos, diseño y reglas del negocio'],
    users: ['Usuarios', 'Accesos al panel']
  };

  const state = {
    user: null,
    section: 'dashboard',
    barbers: [],
    services: [],
    blocks: [],
    settings: null,
    calendarMonth: api.monthBogota(),
    calendarDate: api.todayBogota(),
    calendarView: 'month',
    detail: null
  };

  const els = {
    sidebar: document.getElementById('admin-sidebar'),
    backdrop: document.getElementById('admin-backdrop'),
    menu: document.getElementById('admin-menu'),
    logout: document.getElementById('logout-button'),
    changePassword: document.getElementById('change-password-button'),
    topbarTitle: document.getElementById('topbar-title'),
    topbarSubtitle: document.getElementById('topbar-subtitle'),
    topbarUser: document.getElementById('topbar-user'),
    userAvatar: document.getElementById('user-avatar'),
    sidebarUser: document.getElementById('sidebar-user'),
    dashboardDate: document.getElementById('dashboard-date'),
    dashboardStats: document.getElementById('dashboard-stats'),
    dashboardToday: document.getElementById('dashboard-today'),
    dashboardTodayCount: document.getElementById('dashboard-today-count'),
    dashboardUpcoming: document.getElementById('dashboard-upcoming'),
    dashboardRefresh: document.getElementById('dashboard-refresh'),
    appointmentsFilters: document.getElementById('appointments-filters'),
    appointmentsBarberFilter: document.getElementById('appointments-barber-filter'),
    appointmentsTable: document.getElementById('appointments-table'),
    appointmentsExport: document.getElementById('appointments-export'),
    appointmentNew: document.getElementById('appointment-new'),
    calendarMonth: document.getElementById('admin-calendar-month'),
    calendarGrid: document.getElementById('admin-calendar-grid'),
    calendarPrev: document.getElementById('calendar-prev'),
    calendarNext: document.getElementById('calendar-next'),
    calendarRefresh: document.getElementById('calendar-refresh'),
    calendarBarberFilter: document.getElementById('calendar-barber-filter'),
    barbersList: document.getElementById('barbers-list'),
    barberNew: document.getElementById('barber-new'),
    servicesTable: document.getElementById('services-table'),
    serviceNew: document.getElementById('service-new'),
    blocksTable: document.getElementById('blocks-table'),
    blockNew: document.getElementById('block-new'),
    settingsGroups: document.getElementById('settings-groups'),
    settingsSave: document.getElementById('settings-save'),
    usersTable: document.getElementById('users-table'),
    userNew: document.getElementById('user-new'),
    modal: document.getElementById('modal'),
    modalDialog: document.getElementById('modal-dialog'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalFoot: document.getElementById('modal-foot'),
    modalClose: document.getElementById('modal-close')
  };

  function escape(value) {
    return api.escapeHtml(value);
  }

  function badge(status, label) {
    return `<span class="badge badge--${escape(status)}">${escape(label)}</span>`;
  }

  function statusBadge(status) {
    return badge(status, STATUS_LABELS[status] || status);
  }

  function paymentBadge(status) {
    return badge(status, PAYMENT_STATUS_LABELS[status] || status);
  }

  function options(items, selected, config) {
    const settings = config || {};
    const valueKey = settings.valueKey || 'id';
    const labelKey = settings.labelKey || 'name';
    const placeholder = settings.placeholder
      ? `<option value="">${escape(settings.placeholder)}</option>`
      : '';
    return (
      placeholder +
      items
        .map(
          (item) =>
            `<option value="${escape(item[valueKey])}" ${
              String(item[valueKey]) === String(selected) ? 'selected' : ''
            }>${escape(item[labelKey])}</option>`
        )
        .join('')
    );
  }

  function table(headers, rows, emptyMessage) {
    if (!rows.length) {
      return `<p class="empty-table">${escape(emptyMessage || 'Sin registros.')}</p>`;
    }
    return `<table class="table">
      <thead><tr>${headers.map((header) => `<th>${escape(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
  }

  function toDbInput(value) {
    if (!value) return '';
    const clean = String(value).trim().replace('T', ' ');
    if (clean.length === 16) return `${clean}:00`;
    if (clean.length === 10) return `${clean} 00:00:00`;
    return clean;
  }

  function toInputDateTime(value) {
    if (!value) return '';
    return String(value).replace(' ', 'T').slice(0, 16);
  }

  function monthRange(month) {
    const parts = month.split('-').map(Number);
    const last = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
    return {
      start: `${month}-01`,
      end: `${month}-${String(last).padStart(2, '0')}`
    };
  }

  function dateOf(value) {
    return String(value || '').slice(0, 10);
  }

  function startOfWeekDate(dateStr) {
    const parts = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const offset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  }

  function calendarRange() {
    if (state.calendarView === 'day') {
      return { start: state.calendarDate, end: state.calendarDate };
    }
    if (state.calendarView === 'week') {
      const start = startOfWeekDate(state.calendarDate);
      return { start, end: api.addDays(start, 6) };
    }
    return monthRange(state.calendarMonth);
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatFullDate(dateStr) {
    const date = new Date(`${dateStr}T12:00:00Z`);
    return capitalize(
      new Intl.DateTimeFormat('es-CO', {
        timeZone: 'UTC',
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }).format(date)
    );
  }

  function formatShortDate(dateStr) {
    const date = new Date(`${dateStr}T12:00:00Z`);
    return capitalize(
      new Intl.DateTimeFormat('es-CO', {
        timeZone: 'UTC',
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }).format(date)
    );
  }

  function calendarLabel(range) {
    if (state.calendarView === 'month') {
      return api.monthLabel(state.calendarMonth);
    }
    if (state.calendarView === 'day') {
      return formatFullDate(state.calendarDate);
    }
    return `${formatShortDate(range.start)} — ${formatShortDate(range.end)}`;
  }

  function calendarEventsHtml(appointments, blocks) {
    const events = [
      ...blocks.map(
        (block) =>
          `<span class="calendar-block">${escape(api.formatTime(block.start_datetime))} · ${escape(
            block.reason || 'Bloqueo'
          )}</span>`
      ),
      ...appointments.map(
        (appointment) =>
          `<button type="button" class="calendar-event${
            appointment.status === 'cancelled' ? ' calendar-event--cancelled' : ''
          }" data-view-appointment="${Number(appointment.id)}">${escape(
            api.formatTime(appointment.start_datetime)
          )} · ${escape(appointment.customer_name)}</button>`
      )
    ];
    return events.join('');
  }

  function groupCalendarData(data) {
    const appointmentsByDate = new Map();
    const blocksByDate = new Map();
    for (const appointment of data.appointments || []) {
      const key = dateOf(appointment.start_datetime);
      if (!appointmentsByDate.has(key)) appointmentsByDate.set(key, []);
      appointmentsByDate.get(key).push(appointment);
    }
    for (const block of data.blocks || []) {
      const key = dateOf(block.start_datetime);
      if (!blocksByDate.has(key)) blocksByDate.set(key, []);
      blocksByDate.get(key).push(block);
    }
    return { appointmentsByDate, blocksByDate };
  }

  function setTopbar(section) {
    const meta = SECTION_META[section] || SECTION_META.dashboard;
    els.topbarTitle.textContent = meta[0];
    els.topbarSubtitle.textContent = meta[1];
  }

  function openModal(title, body, foot, wide) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = body;
    els.modalFoot.innerHTML = foot || '';
    els.modalDialog.classList.toggle('modal__dialog--wide', Boolean(wide));
    els.modal.classList.add('is-open');
    els.modal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => {
      const focusable = els.modalBody.querySelector('input, select, textarea, button');
      if (focusable) focusable.focus();
    }, 30);
  }

  function closeModal() {
    els.modal.classList.remove('is-open');
    els.modal.setAttribute('aria-hidden', 'true');
    els.modalBody.innerHTML = '';
    els.modalFoot.innerHTML = '';
    state.detail = null;
  }

  function handleError(error, fallback) {
    if (error && error.status === 401) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/admin/login?next=${next}`);
      return;
    }
    api.showToast((error && error.message) || fallback || 'Ocurrió un error.', 'error');
  }

  function closeSidebar() {
    els.sidebar.classList.remove('is-open');
    els.backdrop.classList.remove('is-open');
  }

  function applyUser() {
    if (!state.user) return;
    const name = state.user.username;
    const initials = name.slice(0, 2).toUpperCase();
    els.topbarUser.textContent = `${name} · ${ROLE_LABELS[state.user.role] || state.user.role}`;
    els.userAvatar.textContent = initials;
    els.sidebarUser.textContent = `${name} · ${ROLE_LABELS[state.user.role] || state.user.role}`;
    if (state.user.role !== 'admin') {
      document.querySelectorAll('[data-admin-only]').forEach((element) => {
        element.style.display = 'none';
      });
    }
  }

  async function ensureBarbers(force) {
    if (state.barbers.length > 0 && !force) return state.barbers;
    const data = await api.get('/api/admin/barbers');
    state.barbers = data.barbers || [];
    populateBarberSelects();
    return state.barbers;
  }

  async function ensureServices(force) {
    if (state.services.length > 0 && !force) return state.services;
    const data = await api.get('/api/admin/services');
    state.services = data.services || [];
    return state.services;
  }

  function populateBarberSelects() {
    [els.appointmentsBarberFilter, els.calendarBarberFilter].forEach((select) => {
      if (!select) return;
      const current = select.value;
      select.innerHTML = options(state.barbers, current, { placeholder: 'Todos' });
    });
  }

  function appointmentRow(appointment, showDate) {
    const start = showDate
      ? `<td><strong>${escape(api.formatDateLong(dateOf(appointment.start_datetime)))}</strong><small>${escape(
          api.formatTime(appointment.start_datetime)
        )}</small></td>`
      : `<td><strong>${escape(api.formatTime(appointment.start_datetime))}</strong><small>${escape(
          api.formatTime(appointment.end_datetime)
        )}</small></td>`;
    return `<tr>
      ${start}
      <td><strong>${escape(appointment.customer_name)}</strong><small>${escape(
      appointment.customer_phone
    )}</small></td>
      <td>${escape(appointment.service_name)}<small>${escape(appointment.barber_name)}</small></td>
      <td>${statusBadge(appointment.status)}</td>
      <td>${paymentBadge(appointment.payment_status)}<small>${escape(
      api.formatCurrency(appointment.price_at_booking)
    )}</small></td>
      <td><button type="button" class="icon-btn" data-view-appointment="${Number(
        appointment.id
      )}">Ver</button></td>
    </tr>`;
  }

  function renderAppointments(target, rows, showDate) {
    target.innerHTML = table(
      [showDate ? 'Fecha' : 'Hora', 'Cliente', 'Servicio', 'Estado', 'Pago', ''],
      rows.map((appointment) => appointmentRow(appointment, showDate)),
      'No hay citas para mostrar.'
    );
  }

  async function loadDashboard() {
    const data = await api.get('/api/admin/dashboard');
    els.dashboardDate.textContent = api.formatDateLong(api.todayBogota());
    const stats = [
      ['Citas de hoy', data.stats.todayCount, 'incluye confirmadas y completadas'],
      ['Confirmadas hoy', data.stats.todayConfirmed, 'pendientes de atender'],
      ['Citas de la semana', data.stats.weekCount, 'semana actual'],
      ['Ingresos de hoy', api.formatCurrency(data.stats.revenueToday), 'pagos confirmados'],
      ['Ingresos de la semana', api.formatCurrency(data.stats.revenueWeek), 'pagos confirmados']
    ];
    els.dashboardStats.innerHTML = stats
      .map(
        ([label, value, hint]) =>
          `<article class="stat-card"><span>${escape(label)}</span><strong>${escape(
            value
          )}</strong><small>${escape(hint)}</small></article>`
      )
      .join('');
    els.dashboardTodayCount.textContent = String(data.todayAppointments.length);
    renderAppointments(els.dashboardToday, data.todayAppointments, false);
    renderAppointments(els.dashboardUpcoming, data.upcoming, true);
  }

  function filtersQuery() {
    const data = new FormData(els.appointmentsFilters);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (String(value).trim()) params.set(key, String(value).trim());
    }
    return params.toString();
  }

  async function loadAppointments() {
    const query = filtersQuery();
    const data = await api.get(`/api/admin/appointments${query ? `?${query}` : ''}`);
    renderAppointments(els.appointmentsTable, data.appointments || [], false);
    els.appointmentsExport.href = `/api/admin/appointments/export${query ? `?${query}` : ''}`;
  }

  async function loadCalendar() {
    const range = calendarRange();
    const params = new URLSearchParams({ start: range.start, end: range.end });
    if (els.calendarBarberFilter && els.calendarBarberFilter.value) {
      params.set('barber_id', els.calendarBarberFilter.value);
    }
    const data = await api.get(`/api/admin/calendar?${params.toString()}`);
    renderAdminCalendar(data, range);
  }

  function renderMonthCalendar(data, range) {
    const parts = state.calendarMonth.split('-').map(Number);
    const year = parts[0];
    const month = parts[1];
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const offset = (firstDay + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const today = api.todayBogota();
    const { appointmentsByDate, blocksByDate } = groupCalendarData(data);

    const cells = [];
    for (let index = 0; index < offset; index += 1) {
      cells.push('<div class="admin-calendar__day" aria-hidden="true"></div>');
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const appointments = appointmentsByDate.get(date) || [];
      const blocks = blocksByDate.get(date) || [];
      cells.push(
        `<div class="admin-calendar__day${date === today ? ' is-today' : ''}">
          <header><span>${day}</span><strong>${appointments.length + blocks.length}</strong></header>
          ${calendarEventsHtml(appointments, blocks)}
        </div>`
      );
    }

    els.calendarGrid.className = 'admin-calendar__grid';
    els.calendarGrid.innerHTML = cells.join('');
    void range;
  }

  function renderPeriodCalendar(data, range) {
    const { appointmentsByDate, blocksByDate } = groupCalendarData(data);
    const today = api.todayBogota();
    const cells = [];
    let cursor = range.start;

    while (cursor <= range.end) {
      const date = cursor;
      const appointments = appointmentsByDate.get(date) || [];
      const blocks = blocksByDate.get(date) || [];
      const events =
        calendarEventsHtml(appointments, blocks) ||
        '<p class="admin-calendar__empty">Sin citas ni bloqueos.</p>';
      cells.push(
        `<div class="admin-calendar__day${date === today ? ' is-today' : ''}">
          <header><span>${escape(
            state.calendarView === 'day' ? formatFullDate(date) : formatShortDate(date)
          )}</span><strong>${appointments.length + blocks.length}</strong></header>
          ${events}
        </div>`
      );
      cursor = api.addDays(cursor, 1);
    }

    els.calendarGrid.className =
      state.calendarView === 'day'
        ? 'admin-calendar__grid admin-calendar__grid--single'
        : 'admin-calendar__grid admin-calendar__grid--week';
    els.calendarGrid.innerHTML = cells.join('');
  }

  function renderAdminCalendar(data, range) {
    if (state.calendarView === 'month') {
      renderMonthCalendar(data, range);
    } else {
      renderPeriodCalendar(data, range);
    }
    els.calendarMonth.textContent = calendarLabel(range);
  }

  function renderBarbers() {
    if (state.barbers.length === 0) {
      els.barbersList.innerHTML = '<p class="empty-table">Todavía no hay barberos registrados.</p>';
      return;
    }
    els.barbersList.innerHTML = state.barbers
      .map((barber) => {
        const services = (barber.services || [])
          .map((service) => `<span class="chip">${escape(service.name)}</span>`)
          .join('');
        const hours = (barber.working_hours || []).length;
        return `<article class="admin-card">
          <div class="admin-card__head">
            <div><h3>${escape(barber.name)}</h3><p>${escape(
          barber.bio || 'Sin descripción.'
        )}</p></div>
            ${barber.active ? badge('confirmed', 'Activo') : badge('cancelled', 'Inactivo')}
          </div>
          <div class="chip-list">${services || '<span class="chip">Sin servicios</span>'}</div>
          <p>${hours} día(s) con horario configurado.</p>
          <div class="admin-card__actions">
            <button type="button" class="icon-btn" data-edit-barber="${Number(
              barber.id
            )}">Editar</button>
            <button type="button" class="icon-btn" data-toggle-barber="${Number(
              barber.id
            )}" data-active="${barber.active ? '1' : '0'}">${
          barber.active ? 'Desactivar' : 'Activar'
        }</button>
            <button type="button" class="icon-btn" data-delete-barber="${Number(
              barber.id
            )}">Eliminar</button>
          </div>
        </article>`;
      })
      .join('');
  }

  async function loadBarbersSection() {
    await Promise.all([ensureBarbers(true), ensureServices()]);
    renderBarbers();
  }

  function renderServices() {
    const rows = state.services.map(
      (service) => `<tr>
        <td><strong>${escape(service.name)}</strong><small>${escape(
        service.description || 'Sin descripción.'
      )}</small></td>
        <td>${escape(api.formatCurrency(service.price))}</td>
        <td>${Number(service.duration_minutes)} min</td>
        <td>${service.active ? badge('confirmed', 'Activo') : badge('cancelled', 'Inactivo')}</td>
        <td><div class="row-actions">
          <button type="button" class="icon-btn" data-edit-service="${Number(service.id)}">Editar</button>
          <button type="button" class="icon-btn" data-toggle-service="${Number(
            service.id
          )}" data-active="${service.active ? '1' : '0'}">${
        service.active ? 'Desactivar' : 'Activar'
      }</button>
          <button type="button" class="icon-btn" data-delete-service="${Number(
            service.id
          )}">Eliminar</button>
        </div></td>
      </tr>`
    );
    els.servicesTable.innerHTML = table(
      ['Servicio', 'Precio', 'Duración', 'Estado', 'Acciones'],
      rows,
      'Todavía no hay servicios registrados.'
    );
  }

  async function loadServicesSection() {
    await ensureServices(true);
    renderServices();
  }

  function renderBlocks() {
    const rows = state.blocks.map(
      (block) => `<tr>
        <td><strong>${escape(block.barber_name || 'Todos los barberos')}</strong></td>
        <td>${escape(api.formatDateTime(block.start_datetime))}</td>
        <td>${escape(api.formatDateTime(block.end_datetime))}</td>
        <td>${escape(block.reason || 'Sin motivo')}</td>
        <td><button type="button" class="icon-btn" data-delete-block="${Number(
          block.id
        )}">Eliminar</button></td>
      </tr>`
    );
    els.blocksTable.innerHTML = table(
      ['Barbero', 'Inicio', 'Fin', 'Motivo', 'Acciones'],
      rows,
      'No hay bloqueos registrados.'
    );
  }

  async function loadBlocksSection() {
    const data = await api.get('/api/admin/blocks?include_past=true');
    state.blocks = data.blocks || [];
    renderBlocks();
  }

  function settingsHoursEditor(hours) {
    const byWeekday = new Map((hours || []).map((hour) => [Number(hour.weekday), hour]));
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return `<div class="hours-editor" data-settings-hours>${days
      .map((day, weekday) => {
        const hour = byWeekday.get(weekday) || { closed: false, start: '09:00', end: '19:00' };
        return `<div class="hours-row" data-weekday="${weekday}">
          <label><input type="checkbox" data-hour-closed ${
            hour.closed ? 'checked' : ''
          }> ${escape(day)}</label>
          <input type="time" data-hour-start value="${escape(
            String(hour.start || '09:00').slice(0, 5)
          )}" aria-label="Inicio ${escape(day)}">
          <input type="time" data-hour-end value="${escape(
            String(hour.end || '19:00').slice(0, 5)
          )}" aria-label="Fin ${escape(day)}">
        </div>`;
      })
      .join('')}</div>`;
  }

  function barberHoursEditor(hours) {
    const byWeekday = new Map((hours || []).map((hour) => [Number(hour.weekday), hour]));
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return `<div class="hours-editor" data-barber-hours>${days
      .map((day, weekday) => {
        const hour = byWeekday.get(weekday) || {
          closed: weekday === 0,
          start_time: '09:00:00',
          end_time: '19:00:00',
          break_start: null,
          break_end: null
        };
        const closed = Boolean(hour.closed);
        return `<div class="hours-row" data-weekday="${weekday}">
          <label><input type="checkbox" data-hour-closed ${
            closed ? 'checked' : ''
          }> ${escape(day)}</label>
          <input type="time" data-hour-start value="${escape(
            String(hour.start_time || '09:00:00').slice(0, 5)
          )}" aria-label="Inicio ${escape(day)}">
          <input type="time" data-hour-end value="${escape(
            String(hour.end_time || '19:00:00').slice(0, 5)
          )}" aria-label="Fin ${escape(day)}">
          <input type="time" data-hour-break-start value="${escape(
            hour.break_start ? String(hour.break_start).slice(0, 5) : ''
          )}" aria-label="Inicio pausa ${escape(day)}">
          <input type="time" data-hour-break-end value="${escape(
            hour.break_end ? String(hour.break_end).slice(0, 5) : ''
          )}" aria-label="Fin pausa ${escape(day)}">
        </div>`;
      })
      .join('')}</div>`;
  }

  function galleryRow(image) {
    return `<div class="field-row" data-gallery-row>
      <label class="field"><span>Ruta o URL</span><input type="text" data-gallery-src value="${escape(
        (image && image.src) || ''
      )}" placeholder="/img/gallery-1.svg"></label>
      <label class="field"><span>Texto alternativo</span><input type="text" data-gallery-alt value="${escape(
        (image && image.alt) || ''
      )}" maxlength="200"></label>
      <button type="button" class="icon-btn" data-gallery-remove>Quitar</button>
    </div>`;
  }

  function galleryEditor(images) {
    const list = images && images.length > 0 ? images : [{ src: '', alt: '' }];
    return `<div data-gallery-editor>${list.map(galleryRow).join('')}</div>
      <button type="button" class="btn btn--ghost btn--small" data-gallery-add>Agregar imagen</button>`;
  }

  function settingField(definition, values, parsed) {
    const key = definition.key;
    const value = values[key];
    const label = `<span>${escape(definition.label)}</span>`;
    const help = definition.help ? `<small>${escape(definition.help)}</small>` : '';

    if (key === 'business_hours') {
      return `<div class="field field--wide">${label}${settingsHoursEditor(
        parsed.business_hours
      )}${help}</div>`;
    }
    if (key === 'gallery_images') {
      return `<div class="field field--wide">${label}${galleryEditor(
        parsed.gallery_images
      )}${help}</div>`;
    }
    if (definition.type === 'boolean') {
      return `<label class="checkbox"><input type="checkbox" data-key="${escape(key)}" ${
        String(value) === '1' ? 'checked' : ''
      }> ${escape(definition.label)}</label>`;
    }
    if (definition.type === 'select') {
      return `<label class="field">${label}<select data-key="${escape(key)}">${options(
        (definition.options || []).map((option) => ({ value: option, label: option })),
        value,
        { valueKey: 'value', labelKey: 'label' }
      )}</select>${help}</label>`;
    }
    if (definition.type === 'color') {
      return `<label class="field">${label}<div class="color-input"><input type="color" data-key="${escape(
        key
      )}" value="${escape(value || '#000000')}"></div>${help}</label>`;
    }
    if (definition.type === 'textarea') {
      return `<label class="field field--wide">${label}<textarea data-key="${escape(
        key
      )}" rows="3" maxlength="${Number(definition.maxLength) || 1000}">${escape(
        value || ''
      )}</textarea>${help}</label>`;
    }
    if (definition.type === 'number') {
      return `<label class="field">${label}<input type="number" data-key="${escape(key)}" value="${escape(
        value || ''
      )}" ${definition.min !== undefined ? `min="${Number(definition.min)}"` : ''} ${
        definition.max !== undefined ? `max="${Number(definition.max)}"` : ''
      }>${help}</label>`;
    }
    return `<label class="field">${label}<input type="text" data-key="${escape(
      key
    )}" value="${escape(value || '')}" maxlength="${Number(definition.maxLength) || 500}">${help}</label>`;
  }

  function renderSettings() {
    if (!state.settings) return;
    const groups = new Map();
    for (const definition of state.settings.definitions) {
      if (!groups.has(definition.group)) groups.set(definition.group, []);
      groups.get(definition.group).push(definition);
    }
    els.settingsGroups.innerHTML = [...groups.entries()]
      .map(
        ([group, definitions]) => `<details class="settings-group" ${
          group === 'business' ? 'open' : ''
        }>
          <summary>${escape(GROUP_LABELS[group] || group)}</summary>
          <div class="settings-group__body">${definitions
            .map((definition) =>
              settingField(definition, state.settings.values, state.settings.parsed)
            )
            .join('')}</div>
        </details>`
      )
      .join('');
  }

  async function loadSettingsSection() {
    state.settings = await api.get('/api/admin/settings');
    renderSettings();
  }

  function collectSettingsHours() {
    const rows = els.settingsGroups.querySelectorAll('[data-settings-hours] [data-weekday]');
    return [...rows].map((row) => ({
      weekday: Number(row.dataset.weekday),
      closed: row.querySelector('[data-hour-closed]').checked,
      start: row.querySelector('[data-hour-start]').value || '09:00',
      end: row.querySelector('[data-hour-end]').value || '19:00'
    }));
  }

  function collectGallery() {
    const rows = els.settingsGroups.querySelectorAll('[data-gallery-row]');
    return [...rows]
      .map((row) => ({
        src: row.querySelector('[data-gallery-src]').value.trim(),
        alt: row.querySelector('[data-gallery-alt]').value.trim()
      }))
      .filter((image) => image.src || image.alt);
  }

  async function saveSettings() {
    const payload = {};
    els.settingsGroups.querySelectorAll('[data-key]').forEach((element) => {
      const key = element.dataset.key;
      payload[key] = element.type === 'checkbox' ? element.checked : element.value;
    });
    payload.business_hours = collectSettingsHours();
    payload.gallery_images = collectGallery();
    api.setBusy(els.settingsSave, true, 'Guardando…');
    try {
      await api.put('/api/admin/settings', payload);
      api.showToast('Configuración guardada.', 'success');
      await loadSettingsSection();
    } catch (error) {
      handleError(error, 'No se pudo guardar la configuración.');
    } finally {
      api.setBusy(els.settingsSave, false);
    }
  }

  function renderUsers() {
    const rows = state.users.map((user) => {
      const isSelf = state.user && Number(user.id) === Number(state.user.id);
      return `<tr>
        <td><strong>${escape(user.username)}</strong><small>${escape(
        ROLE_LABELS[user.role] || user.role
      )}</small></td>
        <td>${escape(user.barber_name || '—')}</td>
        <td>${user.active ? badge('confirmed', 'Activo') : badge('cancelled', 'Inactivo')}</td>
        <td>${user.last_login_at ? escape(api.formatDateTime(user.last_login_at)) : 'Nunca'}</td>
        <td>${
          isSelf
            ? '<span class="chip">Tu cuenta</span>'
            : `<button type="button" class="icon-btn" data-toggle-user="${Number(
                user.id
              )}" data-active="${user.active ? '1' : '0'}">${
                user.active ? 'Desactivar' : 'Activar'
              }</button>`
        }</td>
      </tr>`;
    });
    els.usersTable.innerHTML = table(
      ['Usuario', 'Barbero vinculado', 'Estado', 'Último acceso', 'Acciones'],
      rows,
      'No hay usuarios registrados.'
    );
  }

  async function loadUsersSection() {
    await ensureBarbers();
    const data = await api.get('/api/admin/users');
    state.users = data.users || [];
    renderUsers();
  }

  async function openNewAppointment() {
    try {
      const [barbers, services] = await Promise.all([ensureBarbers(), ensureServices()]);
      const activeBarbers = barbers.filter((barber) => barber.active);
      const activeServices = services.filter((service) => service.active);
      const body = `<form id="new-appointment-form" class="form" novalidate>
        <div class="field-row">
          <label class="field"><span>Servicio</span><select name="service_id" required>${options(
            activeServices,
            '',
            { placeholder: 'Selecciona un servicio' }
          )}</select></label>
          <label class="field"><span>Barbero</span><select name="barber_id">${options(
            activeBarbers,
            'any',
            { placeholder: 'Cualquier barbero' }
          )}</select></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Fecha</span><input type="date" name="date" required></label>
          <label class="field"><span>Hora</span><input type="time" name="time" required></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Cliente</span><input type="text" name="customer_name" required maxlength="100"></label>
          <label class="field"><span>Teléfono</span><input type="tel" name="customer_phone" required maxlength="10" inputmode="numeric"></label>
        </div>
        <label class="field"><span>Email (opcional)</span><input type="email" name="customer_email" maxlength="150"></label>
        <label class="field"><span>Notas</span><textarea name="notes" rows="2" maxlength="500"></textarea></label>
        <div class="field-row">
          <label class="field"><span>Método de pago</span><select name="payment_method">
            <option value="cash_on_site">Pago en el local</option>
            <option value="bank_transfer">Transferencia</option>
          </select></label>
          <label class="field"><span>Estado del pago</span><select name="payment_status">
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
          </select></label>
        </div>
      </form>`;
      openModal(
        'Nueva cita',
        body,
        '<button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button><button type="button" class="btn" data-submit-form="new-appointment-form">Crear cita</button>',
        true
      );
      const form = document.getElementById('new-appointment-form');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        api.setBusy(els.modalFoot.querySelector('[data-submit-form]'), true, 'Creando…');
        try {
          await api.post('/api/admin/appointments', {
            service_id: Number(data.get('service_id')),
            barber_id: data.get('barber_id') || 'any',
            date: data.get('date'),
            time: data.get('time'),
            customer_name: data.get('customer_name'),
            customer_phone: data.get('customer_phone'),
            customer_email: data.get('customer_email') || null,
            notes: data.get('notes') || null,
            payment_method: data.get('payment_method'),
            payment_status: data.get('payment_status')
          });
          closeModal();
          api.showToast('Cita creada correctamente.', 'success');
          await refreshCurrent();
        } catch (error) {
          handleError(error, 'No se pudo crear la cita.');
        } finally {
          const button = els.modalFoot.querySelector('[data-submit-form]');
          if (button) api.setBusy(button, false);
        }
      });
    } catch (error) {
      handleError(error, 'No se pudieron cargar los datos.');
    }
  }

  async function openAppointmentDetail(id) {
    try {
      const data = await api.get(`/api/admin/appointments/${id}`);
      state.detail = data;
      const appointment = data.appointment;
      const canEdit = appointment.status === 'confirmed';
      const barbers = state.barbers.length > 0 ? state.barbers : [];
      const rows = [
        ['Código', appointment.code],
        ['Cliente', appointment.customer_name],
        ['Teléfono', appointment.customer_phone],
        ['Email', appointment.customer_email || '—'],
        ['Servicio', appointment.service_name],
        ['Barbero', appointment.barber_name],
        ['Inicio', api.formatDateTime(appointment.start_datetime)],
        ['Fin', api.formatDateTime(appointment.end_datetime)],
        ['Precio', api.formatCurrency(appointment.price_at_booking)],
        ['Método de pago', PAYMENT_METHOD_LABELS[appointment.payment_method] || appointment.payment_method],
        ['Estado', STATUS_LABELS[appointment.status] || appointment.status],
        ['Pago', PAYMENT_STATUS_LABELS[appointment.payment_status] || appointment.payment_status],
        ['Notas', appointment.notes || '—']
      ];
      if (appointment.cancel_reason) rows.push(['Motivo cancelación', appointment.cancel_reason]);
      const events = (data.events || [])
        .map(
          (event) =>
            `<tr><td>${escape(api.formatDateTime(event.created_at))}</td><td>${escape(
              event.event_type
            )}</td><td>${escape(event.description || '')}</td><td>${escape(
              event.username || 'Sistema'
            )}</td></tr>`
        )
        .join('');
      const body = `
        <div class="detail-card__body">${rows
          .map(
            ([label, value]) =>
              `<div class="detail-row"><span>${escape(label)}</span><strong>${escape(
                value
              )}</strong></div>`
          )
          .join('')}</div>
        <div class="detail-actions">
          ${
            canEdit
              ? `<button type="button" class="btn btn--success btn--small" data-action="complete">Completar</button>
                 <button type="button" class="btn btn--ghost btn--small" data-action="no_show">No asistió</button>`
              : ''
          }
          ${
            appointment.payment_status !== 'paid' && appointment.status !== 'cancelled'
              ? '<button type="button" class="btn btn--ghost btn--small" data-action="paid">Marcar pagada</button>'
              : ''
          }
        </div>
        <div class="admin-card">
          <h3>Notas internas</h3>
          <label class="field"><textarea id="detail-notes" rows="3" maxlength="500">${escape(
            appointment.notes || ''
          )}</textarea></label>
          <div class="admin-card__actions"><button type="button" class="btn btn--ghost btn--small" data-action="notes">Guardar notas</button></div>
        </div>
        ${
          canEdit
            ? `<div class="admin-card">
                <h3>Reprogramar</h3>
                <div class="field-row">
                  <label class="field"><span>Fecha</span><input type="date" id="reschedule-date" value="${escape(
                    dateOf(appointment.start_datetime)
                  )}"></label>
                  <label class="field"><span>Hora</span><input type="time" id="reschedule-time" value="${escape(
                    String(appointment.start_datetime).slice(11, 16)
                  )}"></label>
                </div>
                <label class="field"><span>Barbero</span><select id="reschedule-barber">${options(
                  barbers,
                  appointment.barber_id
                )}</select></label>
                <div class="admin-card__actions"><button type="button" class="btn btn--ghost btn--small" data-action="reschedule">Reprogramar</button></div>
              </div>
              <div class="admin-card">
                <h3>Cancelar cita</h3>
                <label class="field"><span>Motivo (opcional)</span><textarea id="detail-cancel-reason" rows="2" maxlength="255"></textarea></label>
                <div class="admin-card__actions"><button type="button" class="btn btn--danger btn--small" data-action="cancel">Cancelar cita</button></div>
              </div>`
            : ''
        }
        <div class="panel">
          <div class="panel__head"><h3>Historial</h3></div>
          <div class="table-wrap">${
            events
              ? `<table class="table"><thead><tr><th>Fecha</th><th>Evento</th><th>Detalle</th><th>Usuario</th></tr></thead><tbody>${events}</tbody></table>`
              : '<p class="empty-table">Sin eventos registrados.</p>'
          }</div>
        </div>`;
      openModal(
        `Cita ${appointment.code}`,
        body,
        '<button type="button" class="btn btn--ghost" data-modal-close>Cerrar</button>',
        true
      );
    } catch (error) {
      handleError(error, 'No se pudo cargar la cita.');
    }
  }

  async function performDetailAction(action) {
    if (!state.detail) return;
    const appointment = state.detail.appointment;
    try {
      if (action === 'complete' || action === 'no_show') {
        await api.patch(`/api/admin/appointments/${appointment.id}/status`, {
          status: action === 'complete' ? 'completed' : 'no_show'
        });
      } else if (action === 'paid') {
        await api.patch(`/api/admin/appointments/${appointment.id}/payment`);
      } else if (action === 'notes') {
        const notes = document.getElementById('detail-notes').value;
        await api.patch(`/api/admin/appointments/${appointment.id}/notes`, { notes });
      } else if (action === 'cancel') {
        const reason = document.getElementById('detail-cancel-reason').value;
        await api.post(`/api/admin/appointments/${appointment.id}/cancel`, {
          reason: reason || null
        });
      } else if (action === 'reschedule') {
        const date = document.getElementById('reschedule-date').value;
        const time = document.getElementById('reschedule-time').value;
        const barberId = document.getElementById('reschedule-barber').value;
        const payload = { date, time };
        if (barberId) payload.barber_id = Number(barberId);
        await api.patch(`/api/admin/appointments/${appointment.id}/reschedule`, payload);
      } else {
        return;
      }
      closeModal();
      api.showToast('Cita actualizada.', 'success');
      await refreshCurrent();
    } catch (error) {
      handleError(error, 'No se pudo actualizar la cita.');
    }
  }

  async function openBarberModal(barber) {
    try {
      const services = await ensureServices();
      const editing = Boolean(barber);
      const body = `<form id="barber-form" class="form" novalidate>
        <div class="field-row">
          <label class="field"><span>Nombre</span><input type="text" name="name" value="${escape(
            barber ? barber.name : ''
          )}" required maxlength="80"></label>
          <label class="field"><span>Orden</span><input type="number" name="sort_order" value="${Number(
            barber ? barber.sort_order : 0
          )}"></label>
        </div>
        <label class="field"><span>Foto (ruta o URL)</span><input type="text" name="photo_url" value="${escape(
          barber ? barber.photo_url || '' : ''
        )}" maxlength="500" placeholder="/img/barber-placeholder.svg"></label>
        <label class="field"><span>Biografía</span><textarea name="bio" rows="2" maxlength="500">${escape(
          barber ? barber.bio || '' : ''
        )}</textarea></label>
        <label class="checkbox"><input type="checkbox" name="active" ${
          !barber || barber.active ? 'checked' : ''
        }> Activo</label>
        <div class="field"><span>Servicios que ofrece</span>
          <div class="service-checks">${services
            .map(
              (service) =>
                `<label><input type="checkbox" name="service_ids" value="${Number(
                  service.id
                )}" ${
                  barber && (barber.service_ids || []).includes(service.id) ? 'checked' : ''
                }> ${escape(service.name)}</label>`
            )
            .join('')}</div>
        </div>
        <div class="field field--wide"><span>Horario semanal</span>${barberHoursEditor(
          barber ? barber.working_hours : null
        )}</div>
      </form>`;
      openModal(
        editing ? 'Editar barbero' : 'Nuevo barbero',
        body,
        '<button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button><button type="button" class="btn" data-submit-form="barber-form">Guardar</button>',
        true
      );
      const form = document.getElementById('barber-form');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const hours = [...form.querySelectorAll('[data-barber-hours] [data-weekday]')].map(
          (row) => ({
            weekday: Number(row.dataset.weekday),
            closed: row.querySelector('[data-hour-closed]').checked,
            start: row.querySelector('[data-hour-start]').value || null,
            end: row.querySelector('[data-hour-end]').value || null,
            break_start: row.querySelector('[data-hour-break-start]').value || null,
            break_end: row.querySelector('[data-hour-break-end]').value || null
          })
        );
        const payload = {
          name: data.get('name'),
          photo_url: data.get('photo_url') || null,
          bio: data.get('bio') || null,
          active: form.querySelector('[name="active"]').checked,
          sort_order: Number(data.get('sort_order') || 0),
          service_ids: data.getAll('service_ids').map(Number),
          hours
        };
        api.setBusy(els.modalFoot.querySelector('[data-submit-form]'), true, 'Guardando…');
        try {
          if (editing) {
            await api.put(`/api/admin/barbers/${barber.id}`, payload);
          } else {
            await api.post('/api/admin/barbers', payload);
          }
          closeModal();
          api.showToast('Barbero guardado.', 'success');
          await loadBarbersSection();
        } catch (error) {
          handleError(error, 'No se pudo guardar el barbero.');
        } finally {
          const button = els.modalFoot.querySelector('[data-submit-form]');
          if (button) api.setBusy(button, false);
        }
      });
    } catch (error) {
      handleError(error, 'No se pudieron cargar los servicios.');
    }
  }

  function openServiceModal(service) {
    const editing = Boolean(service);
    const body = `<form id="service-form" class="form" novalidate>
      <label class="field"><span>Nombre</span><input type="text" name="name" value="${escape(
        service ? service.name : ''
      )}" required maxlength="80"></label>
      <label class="field"><span>Descripción</span><textarea name="description" rows="2" maxlength="500">${escape(
        service ? service.description || '' : ''
      )}</textarea></label>
      <div class="field-row">
        <label class="field"><span>Precio (COP)</span><input type="number" name="price" value="${Number(
          service ? service.price : 0
        )}" min="0" step="1000" required></label>
        <label class="field"><span>Duración (minutos)</span><input type="number" name="duration_minutes" value="${Number(
          service ? service.duration_minutes : 30
        )}" min="15" max="240" step="15" required></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Orden</span><input type="number" name="sort_order" value="${Number(
          service ? service.sort_order : 0
        )}"></label>
        <label class="checkbox"><input type="checkbox" name="active" ${
          !service || service.active ? 'checked' : ''
        }> Activo</label>
      </div>
    </form>`;
    openModal(
      editing ? 'Editar servicio' : 'Nuevo servicio',
      body,
      '<button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button><button type="button" class="btn" data-submit-form="service-form">Guardar</button>'
    );
    const form = document.getElementById('service-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        name: data.get('name'),
        description: data.get('description') || null,
        price: Number(data.get('price')),
        duration_minutes: Number(data.get('duration_minutes')),
        active: form.querySelector('[name="active"]').checked,
        sort_order: Number(data.get('sort_order') || 0)
      };
      api.setBusy(els.modalFoot.querySelector('[data-submit-form]'), true, 'Guardando…');
      try {
        if (editing) {
          await api.put(`/api/admin/services/${service.id}`, payload);
        } else {
          await api.post('/api/admin/services', payload);
        }
        closeModal();
        api.showToast('Servicio guardado.', 'success');
        await loadServicesSection();
      } catch (error) {
        handleError(error, 'No se pudo guardar el servicio.');
      } finally {
        const button = els.modalFoot.querySelector('[data-submit-form]');
        if (button) api.setBusy(button, false);
      }
    });
  }

  async function openBlockModal() {
    try {
      const barbers = await ensureBarbers();
      const body = `<form id="block-form" class="form" novalidate>
        <label class="field"><span>Barbero</span><select name="barber_id">${options(
          barbers,
          '',
          { placeholder: 'Todos los barberos' }
        )}</select></label>
        <div class="field-row">
          <label class="field"><span>Inicio</span><input type="datetime-local" name="start" required></label>
          <label class="field"><span>Fin</span><input type="datetime-local" name="end" required></label>
        </div>
        <label class="field"><span>Motivo</span><input type="text" name="reason" maxlength="255" placeholder="Vacaciones, pausa, evento…"></label>
        <label class="checkbox"><input type="checkbox" name="cancel_affected"> Cancelar las citas afectadas</label>
        <div class="admin-card">
          <div class="admin-card__actions"><button type="button" class="btn btn--ghost btn--small" id="block-preview">Ver citas afectadas</button></div>
          <div id="block-preview-result"></div>
        </div>
      </form>`;
      openModal(
        'Nuevo bloqueo',
        body,
        '<button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button><button type="button" class="btn" data-submit-form="block-form">Crear bloqueo</button>',
        true
      );
      const form = document.getElementById('block-form');
      const previewButton = document.getElementById('block-preview');
      previewButton.addEventListener('click', async () => {
        const data = new FormData(form);
        const params = new URLSearchParams({
          start: toDbInput(data.get('start')),
          end: toDbInput(data.get('end'))
        });
        if (data.get('barber_id')) params.set('barber_id', data.get('barber_id'));
        try {
          const result = await api.get(`/api/admin/blocks/affected?${params.toString()}`);
          const affected = result.affected || [];
          document.getElementById('block-preview-result').innerHTML = affected.length
            ? `<ul class="chip-list">${affected
                .map(
                  (item) =>
                    `<li class="chip">${escape(item.code)} · ${escape(item.customer_name)} · ${escape(
                      api.formatDateTime(item.start_datetime)
                    )}</li>`
                )
                .join('')}</ul>`
            : '<p class="section-note">No hay citas afectadas.</p>';
        } catch (error) {
          handleError(error, 'No se pudieron revisar las citas afectadas.');
        }
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const payload = {
          barber_id: data.get('barber_id') ? Number(data.get('barber_id')) : null,
          start: toDbInput(data.get('start')),
          end: toDbInput(data.get('end')),
          reason: data.get('reason') || null,
          cancel_affected: form.querySelector('[name="cancel_affected"]').checked
        };
        api.setBusy(els.modalFoot.querySelector('[data-submit-form]'), true, 'Creando…');
        try {
          await api.post('/api/admin/blocks', payload);
          closeModal();
          api.showToast('Bloqueo creado.', 'success');
          await loadBlocksSection();
        } catch (error) {
          if (error.status === 409 && error.details && error.details.affected) {
            document.getElementById('block-preview-result').innerHTML = `<ul class="chip-list">${error.details.affected
              .map(
                (item) =>
                  `<li class="chip">${escape(item.code)} · ${escape(item.customer_name)} · ${escape(
                    api.formatDateTime(item.start_datetime)
                  )}</li>`
              )
              .join('')}</ul><p class="section-note">Marca “Cancelar las citas afectadas” para continuar.</p>`;
            api.showToast('El bloqueo afecta citas. Revisa la lista.', 'error');
          } else {
            handleError(error, 'No se pudo crear el bloqueo.');
          }
        } finally {
          const button = els.modalFoot.querySelector('[data-submit-form]');
          if (button) api.setBusy(button, false);
        }
      });
    } catch (error) {
      handleError(error, 'No se pudieron cargar los barberos.');
    }
  }

  async function openUserModal() {
    try {
      const barbers = await ensureBarbers();
      const body = `<form id="user-form" class="form" novalidate>
        <div class="field-row">
          <label class="field"><span>Usuario</span><input type="text" name="username" required minlength="3" maxlength="80"></label>
          <label class="field"><span>Contraseña</span><input type="password" name="password" required minlength="8" maxlength="128"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Rol</span><select name="role">
            <option value="barber">Barbero</option>
            <option value="admin">Administrador</option>
          </select></label>
          <label class="field" id="user-barber-field"><span>Barbero vinculado</span><select name="barber_id">${options(
            barbers,
            '',
            { placeholder: 'Selecciona un barbero' }
          )}</select></label>
        </div>
        <label class="checkbox"><input type="checkbox" name="must_change_password"> Pedir cambio de contraseña al ingresar</label>
      </form>`;
      openModal(
        'Nuevo usuario',
        body,
        '<button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button><button type="button" class="btn" data-submit-form="user-form">Crear usuario</button>'
      );
      const form = document.getElementById('user-form');
      const roleSelect = form.querySelector('[name="role"]');
      const barberField = document.getElementById('user-barber-field');
      const syncRole = () => {
        const isBarber = roleSelect.value === 'barber';
        barberField.style.display = isBarber ? '' : 'none';
        form.querySelector('[name="barber_id"]').required = isBarber;
      };
      roleSelect.addEventListener('change', syncRole);
      syncRole();
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const role = data.get('role');
        api.setBusy(els.modalFoot.querySelector('[data-submit-form]'), true, 'Creando…');
        try {
          await api.post('/api/admin/users', {
            username: data.get('username'),
            password: data.get('password'),
            role,
            barber_id: role === 'barber' ? Number(data.get('barber_id')) : null,
            must_change_password: form.querySelector('[name="must_change_password"]').checked
          });
          closeModal();
          api.showToast('Usuario creado.', 'success');
          await loadUsersSection();
        } catch (error) {
          handleError(error, 'No se pudo crear el usuario.');
        } finally {
          const button = els.modalFoot.querySelector('[data-submit-form]');
          if (button) api.setBusy(button, false);
        }
      });
    } catch (error) {
      handleError(error, 'No se pudieron cargar los barberos.');
    }
  }

  function openChangePasswordModal() {
    const body = `<form id="change-password-form" class="form" novalidate>
      <label class="field"><span>Contraseña actual</span><input type="password" name="current_password" required minlength="8" maxlength="128" autocomplete="current-password"></label>
      <label class="field"><span>Nueva contraseña</span><input type="password" name="new_password" required minlength="8" maxlength="128" autocomplete="new-password"></label>
      <label class="field"><span>Confirmar nueva contraseña</span><input type="password" name="confirm_password" required minlength="8" maxlength="128" autocomplete="new-password"></label>
      <p class="form-hint">La nueva contraseña debe tener al menos 8 caracteres.</p>
    </form>`;
    openModal(
      'Cambiar contraseña',
      body,
      '<button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button><button type="button" class="btn" data-submit-form="change-password-form">Guardar contraseña</button>'
    );

    const form = document.getElementById('change-password-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const currentPassword = String(data.get('current_password') || '');
      const newPassword = String(data.get('new_password') || '');
      const confirmation = String(data.get('confirm_password') || '');

      if (newPassword.length < 8) {
        api.showToast('La nueva contraseña debe tener al menos 8 caracteres.', 'error');
        form.querySelector('[name="new_password"]').focus();
        return;
      }
      if (newPassword !== confirmation) {
        api.showToast('La confirmación no coincide con la nueva contraseña.', 'error');
        form.querySelector('[name="confirm_password"]').focus();
        return;
      }

      const button = els.modalFoot.querySelector('[data-submit-form]');
      api.setBusy(button, true, 'Guardando…');
      try {
        await api.post('/api/auth/change-password', {
          current_password: currentPassword,
          new_password: newPassword
        });
        closeModal();
        api.showToast('Contraseña actualizada correctamente.', 'success');
      } catch (error) {
        handleError(error, 'No se pudo cambiar la contraseña.');
      } finally {
        const submitButton = els.modalFoot.querySelector('[data-submit-form]');
        if (submitButton) api.setBusy(submitButton, false);
      }
    });
  }

  async function refreshCurrent() {
    if (state.section === 'dashboard') await loadDashboard();
    else if (state.section === 'appointments') await loadAppointments();
    else if (state.section === 'calendar') await loadCalendar();
    else if (state.section === 'barbers') await loadBarbersSection();
    else if (state.section === 'services') await loadServicesSection();
    else if (state.section === 'blocks') await loadBlocksSection();
    else if (state.section === 'settings') await loadSettingsSection();
    else if (state.section === 'users') await loadUsersSection();
  }

  async function switchSection(section) {
    state.section = section;
    document.querySelectorAll('.admin-nav [data-section]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.section === section);
    });
    document.querySelectorAll('[data-section-panel]').forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.sectionPanel === section);
    });
    setTopbar(section);
    closeSidebar();
    try {
      await refreshCurrent();
    } catch (error) {
      handleError(error, 'No se pudo cargar la sección.');
    }
  }

  function bindEvents() {
    document.querySelectorAll('.admin-nav [data-section]').forEach((button) => {
      button.addEventListener('click', () => switchSection(button.dataset.section));
    });

    els.menu.addEventListener('click', () => {
      els.sidebar.classList.toggle('is-open');
      els.backdrop.classList.toggle('is-open');
    });
    els.backdrop.addEventListener('click', closeSidebar);
    els.modalClose.addEventListener('click', closeModal);
    els.modal.addEventListener('click', (event) => {
      if (event.target === els.modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal();
        closeSidebar();
      }
    });

    if (els.changePassword) {
      els.changePassword.addEventListener('click', openChangePasswordModal);
    }

    els.logout.addEventListener('click', async () => {
      try {
        await api.post('/api/auth/logout');
      } catch (error) {
        // La sesión se cierra igualmente en el servidor si el token ya expiró.
      }
      window.location.assign('/admin/login');
    });

    els.dashboardRefresh.addEventListener('click', () => {
      loadDashboard().catch((error) => handleError(error));
    });
    els.appointmentsFilters.addEventListener('submit', (event) => {
      event.preventDefault();
      loadAppointments().catch((error) => handleError(error));
    });
    document.getElementById('appointments-clear').addEventListener('click', () => {
      els.appointmentsFilters.reset();
      loadAppointments().catch((error) => handleError(error));
    });
    els.appointmentNew.addEventListener('click', openNewAppointment);

    document.querySelectorAll('[data-calendar-view]').forEach((button) => {
      button.addEventListener('click', () => {
        state.calendarView = button.dataset.calendarView;
        if (state.calendarView === 'month') {
          state.calendarMonth = state.calendarDate.slice(0, 7);
        }
        document.querySelectorAll('[data-calendar-view]').forEach((item) => {
          item.classList.toggle('is-active', item === button);
        });
        loadCalendar().catch((error) => handleError(error));
      });
    });

    els.calendarPrev.addEventListener('click', () => {
      if (state.calendarView === 'month') {
        state.calendarMonth = api.addMonths(state.calendarMonth, -1);
        state.calendarDate = `${state.calendarMonth}-01`;
      } else {
        state.calendarDate = api.addDays(
          state.calendarDate,
          state.calendarView === 'week' ? -7 : -1
        );
      }
      loadCalendar().catch((error) => handleError(error));
    });
    els.calendarNext.addEventListener('click', () => {
      if (state.calendarView === 'month') {
        state.calendarMonth = api.addMonths(state.calendarMonth, 1);
        state.calendarDate = `${state.calendarMonth}-01`;
      } else {
        state.calendarDate = api.addDays(
          state.calendarDate,
          state.calendarView === 'week' ? 7 : 1
        );
      }
      loadCalendar().catch((error) => handleError(error));
    });
    els.calendarRefresh.addEventListener('click', () => {
      loadCalendar().catch((error) => handleError(error));
    });
    if (els.calendarBarberFilter) {
      els.calendarBarberFilter.addEventListener('change', () => {
        loadCalendar().catch((error) => handleError(error));
      });
    }

    els.barberNew.addEventListener('click', () => openBarberModal(null));
    els.serviceNew.addEventListener('click', () => openServiceModal(null));
    els.blockNew.addEventListener('click', openBlockModal);
    els.userNew.addEventListener('click', openUserModal);
    els.settingsSave.addEventListener('click', saveSettings);

    els.modalBody.addEventListener('change', (event) => {
      if (event.target.matches('[data-hour-closed]')) {
        const row = event.target.closest('[data-weekday]');
        row.querySelectorAll('input[type="time"]').forEach((input) => {
          input.disabled = event.target.checked;
        });
      }
    });

    document.addEventListener('click', (event) => {
      const close = event.target.closest('[data-modal-close]');
      if (close) {
        closeModal();
        return;
      }
      const submit = event.target.closest('[data-submit-form]');
      if (submit) {
        const form = document.getElementById(submit.dataset.submitForm);
        if (form) form.requestSubmit();
        return;
      }
      const view = event.target.closest('[data-view-appointment]');
      if (view) {
        openAppointmentDetail(view.dataset.viewAppointment);
        return;
      }
      const action = event.target.closest('[data-action]');
      if (action) {
        performDetailAction(action.dataset.action);
        return;
      }
      const editBarber = event.target.closest('[data-edit-barber]');
      if (editBarber) {
        const barber = state.barbers.find(
          (item) => Number(item.id) === Number(editBarber.dataset.editBarber)
        );
        if (barber) openBarberModal(barber);
        return;
      }
      const toggleBarber = event.target.closest('[data-toggle-barber]');
      if (toggleBarber) {
        api
          .patch(`/api/admin/barbers/${toggleBarber.dataset.toggleBarber}/active`, {
            active: toggleBarber.dataset.active !== '1'
          })
          .then(() => {
            api.showToast('Barbero actualizado.', 'success');
            return loadBarbersSection();
          })
          .catch((error) => handleError(error));
        return;
      }
      const deleteBarber = event.target.closest('[data-delete-barber]');
      if (deleteBarber) {
        if (!window.confirm('¿Eliminar este barbero? Esta acción no se puede deshacer.')) return;
        api
          .del(`/api/admin/barbers/${deleteBarber.dataset.deleteBarber}`)
          .then(() => {
            api.showToast('Barbero eliminado.', 'success');
            return loadBarbersSection();
          })
          .catch((error) => handleError(error));
        return;
      }
      const editService = event.target.closest('[data-edit-service]');
      if (editService) {
        const service = state.services.find(
          (item) => Number(item.id) === Number(editService.dataset.editService)
        );
        if (service) openServiceModal(service);
        return;
      }
      const toggleService = event.target.closest('[data-toggle-service]');
      if (toggleService) {
        api
          .patch(`/api/admin/services/${toggleService.dataset.toggleService}/active`, {
            active: toggleService.dataset.active !== '1'
          })
          .then(() => {
            api.showToast('Servicio actualizado.', 'success');
            return loadServicesSection();
          })
          .catch((error) => handleError(error));
        return;
      }
      const deleteService = event.target.closest('[data-delete-service]');
      if (deleteService) {
        if (!window.confirm('¿Eliminar este servicio? Esta acción no se puede deshacer.')) return;
        api
          .del(`/api/admin/services/${deleteService.dataset.deleteService}`)
          .then(() => {
            api.showToast('Servicio eliminado.', 'success');
            return loadServicesSection();
          })
          .catch((error) => handleError(error));
        return;
      }
      const deleteBlock = event.target.closest('[data-delete-block]');
      if (deleteBlock) {
        if (!window.confirm('¿Eliminar este bloqueo?')) return;
        api
          .del(`/api/admin/blocks/${deleteBlock.dataset.deleteBlock}`)
          .then(() => {
            api.showToast('Bloqueo eliminado.', 'success');
            return loadBlocksSection();
          })
          .catch((error) => handleError(error));
        return;
      }
      const toggleUser = event.target.closest('[data-toggle-user]');
      if (toggleUser) {
        api
          .patch(`/api/admin/users/${toggleUser.dataset.toggleUser}/active`, {
            active: toggleUser.dataset.active !== '1'
          })
          .then(() => {
            api.showToast('Usuario actualizado.', 'success');
            return loadUsersSection();
          })
          .catch((error) => handleError(error));
        return;
      }
      const galleryAdd = event.target.closest('[data-gallery-add]');
      if (galleryAdd) {
        const editor = galleryAdd.previousElementSibling;
        if (editor) editor.insertAdjacentHTML('beforeend', galleryRow({ src: '', alt: '' }));
        return;
      }
      const galleryRemove = event.target.closest('[data-gallery-remove]');
      if (galleryRemove) {
        const row = galleryRemove.closest('[data-gallery-row]');
        const editor = row.parentElement;
        if (editor.querySelectorAll('[data-gallery-row]').length > 1) row.remove();
        return;
      }
    });
  }

  async function init() {
    bindEvents();
    try {
      await api.fetchCsrfToken();
      const me = await api.get('/api/auth/me');
      if (!me.user) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/admin/login?next=${next}`);
        return;
      }
      state.user = me.user;
      applyUser();
      await switchSection('dashboard');
    } catch (error) {
      handleError(error, 'No se pudo cargar el panel.');
    }
  }

  init();
})();
