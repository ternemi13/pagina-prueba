process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'barberia_test';

const config = require('../src/config');
const { resetDatabase } = require('../scripts/lib/db');
const { seedDatabase } = require('../scripts/seed');
const { dayjs, TZ } = require('../src/utils/datetime');

class DbUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DbUnavailableError';
  }
}

function friendlyError(error) {
  if (!error) return 'Error desconocido de base de datos.';
  if (
    [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'PROTOCOL_CONNECTION_LOST',
      'ENOTFOUND',
      'EHOSTUNREACH'
    ].includes(error.code)
  ) {
    return 'No se pudo conectar a MySQL. Enciende MySQL desde el panel de XAMPP e inténtalo de nuevo.';
  }
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    return 'MySQL rechazó las credenciales. Revisa DB_USER y DB_PASSWORD en el archivo .env.';
  }
  return error.message || String(error);
}

let readyPromise = null;

async function initialiseDatabase() {
  try {
    await resetDatabase(config.db.database);
    await seedDatabase();
  } catch (error) {
    readyPromise = null;
    throw new DbUnavailableError(friendlyError(error));
  }
}

function dbReady() {
  if (!readyPromise) readyPromise = initialiseDatabase();
  return readyPromise;
}

function nextWeekday(weekday, minDaysAhead = 7) {
  let date = dayjs().tz(TZ).startOf('day').add(minDaysAhead, 'day');
  while (date.day() !== weekday) {
    date = date.add(1, 'day');
  }
  return date.format('YYYY-MM-DD');
}

function futureDate(daysAhead) {
  return dayjs().tz(TZ).startOf('day').add(daysAhead, 'day').format('YYYY-MM-DD');
}

async function skipIfNoDatabase(t) {
  try {
    await dbReady();
    return false;
  } catch (error) {
    t.skip(error.message);
    return true;
  }
}

module.exports = {
  config,
  DbUnavailableError,
  dbReady,
  skipIfNoDatabase,
  nextWeekday,
  futureDate
};
