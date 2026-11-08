const rateLimit = require('express-rate-limit');
const config = require('../config');

function createLimiter(max, message) {
  return rateLimit({
    windowMs: config.limits.windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message
        }
      });
    }
  });
}

const publicBookingLimiter = createLimiter(
  config.limits.publicBookingPerWindow,
  'Demasiadas solicitudes de reserva. Espera unos minutos e inténtalo de nuevo.'
);

const publicLookupLimiter = createLimiter(
  config.limits.publicLookupPerWindow,
  'Demasiadas consultas. Espera unos minutos e inténtalo de nuevo.'
);

const authLimiter = createLimiter(
  config.limits.authPerWindow,
  'Demasiados intentos de acceso. Espera unos minutos e inténtalo de nuevo.'
);

module.exports = {
  publicBookingLimiter,
  publicLookupLimiter,
  authLimiter
};
