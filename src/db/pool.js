const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4',
  dateStrings: true,
  timezone: '-05:00',
  decimalNumbers: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

function isConnectionError(error) {
  if (!error) return false;
  return [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ER_CON_COUNT_ERROR'
  ].includes(error.code);
}

function connectionErrorMessage(error) {
  if (isConnectionError(error)) {
    return 'No se pudo conectar a MySQL. Enciende MySQL desde el panel de XAMPP e inténtalo de nuevo.';
  }
  if (error && error.code === 'ER_BAD_DB_ERROR') {
    return `La base de datos "${config.db.database}" no existe. Ejecuta npm run db:init o npm run db:reset.`;
  }
  if (error && error.code === 'ER_ACCESS_DENIED_ERROR') {
    return 'MySQL rechazó las credenciales. Revisa DB_USER y DB_PASSWORD en el archivo .env.';
  }
  return error && error.message ? error.message : 'Error desconocido de base de datos.';
}

async function execute(sql, params = [], executor = pool) {
  const target = executor || pool;
  const [rows] = await target.execute(sql, params);
  return rows;
}

async function all(sql, params = [], executor = pool) {
  return execute(sql, params, executor);
}

async function one(sql, params = [], executor = pool) {
  const rows = await execute(sql, params, executor);
  return rows.length > 0 ? rows[0] : null;
}

async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // El error original es el relevante; el rollback solo se intenta.
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function testConnection() {
  await pool.query('SELECT 1');
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  execute,
  all,
  one,
  withTransaction,
  testConnection,
  closePool,
  isConnectionError,
  connectionErrorMessage
};
