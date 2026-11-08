const { asyncHandler } = require('../utils/errors');
const config = require('../config');
const {
  authenticate,
  changePassword
} = require('../services/auth');
const { csrfTokenHandler } = require('../middleware/csrf');

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

const getCsrfToken = csrfTokenHandler;

const login = asyncHandler(async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  const user = await authenticate({
    username: req.body.username,
    password: req.body.password,
    ip
  });

  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.csrfInit = true;
  await saveSession(req);

  res.json({ user });
});

const logout = asyncHandler(async (req, res) => {
  await new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
  res.clearCookie(config.session.name);
  res.clearCookie(config.session.cookieName);
  res.json({ ok: true });
});

const me = (req, res) => {
  res.json({ user: req.user || null });
};

const updatePassword = asyncHandler(async (req, res) => {
  await changePassword({
    userId: req.user.id,
    currentPassword: req.body.current_password,
    newPassword: req.body.new_password
  });
  res.json({
    ok: true,
    message: 'Contraseña actualizada correctamente.'
  });
});

module.exports = {
  getCsrfToken,
  login,
  logout,
  me,
  updatePassword
};
