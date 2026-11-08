class AppError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = options.code || 'APP_ERROR';
    this.details = options.details || null;
    this.expose = options.expose !== false;
  }
}

function badRequest(message, details = null) {
  return new AppError(400, message, { code: 'BAD_REQUEST', details });
}

function unauthorized(message = 'Debes iniciar sesión.') {
  return new AppError(401, message, { code: 'UNAUTHORIZED' });
}

function forbidden(message = 'No tienes permiso para realizar esta acción.') {
  return new AppError(403, message, { code: 'FORBIDDEN' });
}

function notFound(message = 'No encontrado.') {
  return new AppError(404, message, { code: 'NOT_FOUND' });
}

function conflict(message, details = null) {
  return new AppError(409, message, { code: 'CONFLICT', details });
}

function tooManyRequests(message, details = null) {
  return new AppError(429, message, { code: 'TOO_MANY_REQUESTS', details });
}

function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function notFoundHandler(req, res) {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' }
    });
    return;
  }
  res.status(404).send('Página no encontrada.');
}

function isCsrfError(error) {
  return (
    error &&
    (error.code === 'EBADCSRFTOKEN' ||
      error.name === 'ForbiddenError' ||
      /csrf/i.test(error.message || ''))
  );
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (isCsrfError(error)) {
    res.status(403).json({
      error: {
        code: 'CSRF_INVALID',
        message: 'La sesión de seguridad expiró. Recarga la página e inténtalo de nuevo.'
      }
    });
    return;
  }

  if (error && error.type === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'El cuerpo de la solicitud no es válido.' }
    });
    return;
  }

  const status = error instanceof AppError ? error.status : 500;
  const isServerError = status >= 500;

  if (isServerError) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    console.error(error && error.stack ? error.stack : error);
  }

  if (req.path.startsWith('/api/')) {
    res.status(status).json({
      error: {
        code: error.code || (isServerError ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
        message:
          error.expose === false || isServerError
            ? 'Ocurrió un error inesperado. Inténtalo de nuevo.'
            : error.message,
        details: error instanceof AppError ? error.details : null
      }
    });
    return;
  }

  res.status(status).send(
    isServerError
      ? 'Ocurrió un error inesperado. Revisa la consola del servidor.'
      : error.message
  );
}

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  asyncHandler,
  notFoundHandler,
  errorHandler,
  isCsrfError
};
