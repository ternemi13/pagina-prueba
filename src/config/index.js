const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error(
    'Falta SESSION_SECRET o es demasiado corto. Define un secreto de al menos 32 caracteres en el archivo .env.'
  );
}

const port = Number.parseInt(process.env.PORT || '3000', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT no es válido. Debe ser un número entre 1 y 65535.');
}

const dbPort = Number.parseInt(process.env.DB_PORT || '3306', 10);
if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
  throw new Error('DB_PORT no es válido. Debe ser un número entre 1 y 65535.');
}

const config = {
  env: nodeEnv,
  isProduction,
  isTest,
  port,
  timezone: 'America/Bogota',
  currency: 'COP',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: dbPort,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'barberia',
    connectionLimit: Number.parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10)
  },
  session: {
    secret: process.env.SESSION_SECRET,
    name: isProduction ? '__Host-barberia.sid' : 'barberia.sid',
    maxAgeMs: 2 * 60 * 60 * 1000,
    cookieName: isProduction ? '__Host-barberia.csrf' : 'barberia.csrf'
  },
  security: {
    bcryptRounds: 12,
    loginMaxAttempts: 5,
    loginWindowMinutes: 15,
    loginBlockMinutes: 15
  },
  limits: {
    publicBookingPerWindow: isTest ? 10000 : 40,
    publicLookupPerWindow: isTest ? 10000 : 40,
    authPerWindow: isTest ? 10000 : 20,
    windowMs: 10 * 60 * 1000
  }
};

module.exports = config;
