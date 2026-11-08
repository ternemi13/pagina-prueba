const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { sessionMiddleware } = require('./middleware/session');
const { loadUser, requireAuthPage } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./utils/errors');
const pages = require('./controllers/pages');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();

if (config.isProduction) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        frameSrc: ["'self'", 'https://www.google.com', 'https://maps.google.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: config.isProduction ? [] : null
      }
    }
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(loadUser);

app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    index: false,
    maxAge: config.isProduction ? '7d' : 0,
    etag: true
  })
);

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', pages.landing);
app.get('/reservar', pages.booking);
app.get('/consulta', pages.lookup);
app.get('/admin/login', pages.login);
app.get(['/admin', '/admin/*'], requireAuthPage, pages.admin);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
