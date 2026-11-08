const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../../src/config');

const DATABASE_DIR = path.resolve(__dirname, '../../database');

function quoteIdentifier(value) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Nombre de base de datos no válido: ${value}`);
  }
  return `\`${value}\``;
}

function connectionOptions(extra = {}) {
  return {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    charset: 'utf8mb4',
    multipleStatements: true,
    ...extra
  };
}

function friendlyDbError(error) {
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

function printAndExit(error) {
  console.error(`\n✖ ${friendlyDbError(error)}\n`);
  process.exitCode = 1;
}

async function rootConnection() {
  return mysql.createConnection(connectionOptions());
}

async function createDatabase(databaseName = config.db.database) {
  const connection = await rootConnection();
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function dropDatabase(databaseName = config.db.database) {
  const connection = await rootConnection();
  try {
    await connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
  } finally {
    await connection.end();
  }
}

async function runSqlFile(filePath, databaseName = config.db.database) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const connection = await mysql.createConnection(
    connectionOptions({ database: databaseName })
  );
  try {
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}

async function runSchema(databaseName = config.db.database) {
  await runSqlFile(path.join(DATABASE_DIR, 'schema.sql'), databaseName);
}

async function runSeedSql(databaseName = config.db.database) {
  await runSqlFile(path.join(DATABASE_DIR, 'seed.sql'), databaseName);
}

async function resetDatabase(databaseName = config.db.database) {
  await dropDatabase(databaseName);
  await createDatabase(databaseName);
  await runSchema(databaseName);
}

module.exports = {
  DATABASE_DIR,
  quoteIdentifier,
  friendlyDbError,
  printAndExit,
  rootConnection,
  createDatabase,
  dropDatabase,
  runSqlFile,
  runSchema,
  runSeedSql,
  resetDatabase
};
