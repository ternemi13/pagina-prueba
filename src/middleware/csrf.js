const { doubleCsrf } = require('csrf-csrf');
const config = require('../config');

const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => config.session.secret,
  getSessionIdentifier: (req) => (req.session && req.session.id) || '',
  cookieName: config.session.cookieName,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  errorConfig: {
    statusCode: 403,
    message: 'Token CSRF inválido o expirado. Recarga la página e inténtalo de nuevo.',
    code: 'EBADCSRFTOKEN'
  }
});

function issueCsrfToken(req, res) {
  if (req.session && !req.session.csrfInit) {
    req.session.csrfInit = true;
  }
  return generateCsrfToken(req, res);
}

function csrfTokenHandler(req, res) {
  const csrfToken = issueCsrfToken(req, res);
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken });
}

module.exports = {
  generateCsrfToken,
  issueCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError,
  csrfTokenHandler
};
