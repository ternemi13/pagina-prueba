(function () {
  'use strict';

  const TZ = 'America/Bogota';
  let csrfToken = null;
  let csrfPromise = null;

  class ApiError extends Error {
    constructor(message, status, code, details) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details || null;
    }
  }

  function metaCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
  }

  async function fetchCsrfToken(force) {
    if (!force && csrfToken) return csrfToken;
    if (!force) {
      const meta = metaCsrfToken();
      if (meta) {
        csrfToken = meta;
        return csrfToken;
      }
    }
    if (csrfPromise) return csrfPromise;

    csrfPromise = fetch('/api/auth/csrf', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new ApiError(
            data.error && data.error.message
              ? data.error.message
              : 'No se pudo preparar la seguridad de la página.',
            response.status,
            data.error && data.error.code
          );
        }
        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });

    return csrfPromise;
  }

  async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json().catch(() => ({}));
    }
    return response.text().catch(() => '');
  }

  async function request(url, options) {
    const config = Object.assign(
      {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      },
      options || {}
    );
    config.headers = Object.assign({}, config.headers || {});

    const method = String(config.method || 'GET').toUpperCase();
    const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (needsCsrf) {
      config.headers['x-csrf-token'] = await fetchCsrfToken(false);
    }

    if (config.body && !(config.body instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(config.body);
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (error) {
      throw new ApiError(
        'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
        0,
        'NETWORK_ERROR'
      );
    }

    let data = null;
    if (response.status === 403 && needsCsrf) {
      const firstData = await parseResponse(response);
      const firstCode = firstData && firstData.error ? firstData.error.code : '';
      if (firstCode === 'CSRF_INVALID' || firstCode === 'EBADCSRFTOKEN') {
        csrfToken = null;
        await fetchCsrfToken(true);
        config.headers['x-csrf-token'] = csrfToken;
        response = await fetch(url, config);
        data = await parseResponse(response);
      } else {
        data = firstData;
      }
    } else {
      data = await parseResponse(response);
    }
    if (!response.ok) {
      const error = data && data.error ? data.error : {};
      throw new ApiError(
        error.message || 'No se pudo completar la solicitud.',
        response.status,
        error.code || 'REQUEST_ERROR',
        error.details
      );
    }
    return data;
  }

  function parseBogota(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    let text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += ' 00:00:00';
    text = text.replace(' ', 'T');
    if (!/(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
      text += '-05:00';
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(value) {
    const date = parseBogota(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: TZ,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function formatDateLong(value) {
    const date = parseBogota(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: TZ,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  function formatTime(value) {
    const date = parseBogota(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  function formatCurrency(amount, currency) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      maximumFractionDigits: 0
    }).format(Number(amount) || 0);
  }

  function todayBogota() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  function monthBogota() {
    return todayBogota().slice(0, 7);
  }

  function addMonths(month, delta) {
    const parts = String(month).split('-').map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(month) {
    const parts = String(month).split('-').map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, 1));
    const label = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric'
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function addDays(dateStr, delta) {
    const parts = String(dateStr).split('-').map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + delta));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
      date.getUTCDate()
    ).padStart(2, '0')}`;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[char]
    );
  }

  function showToast(message, type) {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const toast = document.createElement('div');
    toast.className = `toast${type ? ` toast--${type}` : ''}`;
    toast.textContent = message;
    stack.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'opacity .2s ease, transform .2s ease';
      window.setTimeout(() => toast.remove(), 220);
    }, 4200);
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = busyLabel || 'Procesando…';
    } else {
      button.disabled = false;
      if (button.dataset.originalLabel) {
        button.textContent = button.dataset.originalLabel;
      }
    }
  }

  window.BarberiaApi = {
    ApiError,
    fetchCsrfToken,
    request,
    get: (url) => request(url),
    post: (url, body) => request(url, { method: 'POST', body }),
    put: (url, body) => request(url, { method: 'PUT', body }),
    patch: (url, body) => request(url, { method: 'PATCH', body }),
    del: (url, body) => request(url, { method: 'DELETE', body }),
    formatDateTime,
    formatDateLong,
    formatTime,
    formatCurrency,
    parseBogota,
    todayBogota,
    monthBogota,
    addMonths,
    monthLabel,
    addDays,
    escapeHtml,
    showToast,
    setBusy
  };
})();
