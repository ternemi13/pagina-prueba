const { getUserById } = require('../services/auth');

async function loadUser(req, res, next) {
  if (!req.session || !req.session.userId) return next();
  try {
    const user = await getUserById(req.session.userId);
    if (!user) {
      return req.session.destroy(() => next());
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuthApi(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Debes iniciar sesión para continuar.'
      }
    });
  }
  return next();
}

function requireAuthPage(req, res, next) {
  if (!req.user) {
    const nextUrl = encodeURIComponent(req.originalUrl || '/admin');
    return res.redirect(`/admin/login?next=${nextUrl}`);
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Debes iniciar sesión para continuar.'
        }
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para realizar esta acción.'
        }
      });
    }
    return next();
  };
}

function redirectIfAuthenticated(req, res, next) {
  if (req.user) return res.redirect('/admin');
  return next();
}

function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  return next();
}

function requirePasswordChanged(req, res, next) {
  if (req.user && req.user.mustChangePassword) {
    if (req.path === '/cambiar-password' || req.path === '/logout') {
      return next();
    }
    if (req.accepts(['html', 'json']) === 'json') {
      return res.status(403).json({
        error: {
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Debes cambiar tu contraseña antes de continuar.'
        }
      });
    }
    return res.redirect('/admin/cambiar-password');
  }
  return next();
}

module.exports = {
  loadUser,
  requireAuthApi,
  requireAuthPage,
  requireRole,
  redirectIfAuthenticated,
  noCache,
  requirePasswordChanged
};
