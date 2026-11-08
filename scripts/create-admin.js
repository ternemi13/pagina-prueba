const readline = require('readline');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const config = require('../src/config');
const { friendlyDbError } = require('./lib/db');

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  if (!process.stdin.isTTY) {
    return ask(question);
  }

  return new Promise((resolve, reject) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      stdin.removeListener('data', onData);
      if (stdin.isTTY) stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
      process.stdout.write('\n');
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          cleanup();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Operación cancelada.'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        value += char;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  let connection;
  try {
    console.log('\nCrear usuario administrador de Barbería\n');

    const username = await ask('Usuario: ');
    if (!/^[A-Za-z0-9._-]{3,60}$/.test(username)) {
      throw new Error(
        'El usuario debe tener entre 3 y 60 caracteres y solo puede usar letras, números, punto, guion y guion bajo.'
      );
    }

    const password = await askHidden('Contraseña: ');
    if (password.length < 8 || password.length > 128) {
      throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
    }

    const confirmation = await askHidden('Confirma la contraseña: ');
    if (password !== confirmation) {
      throw new Error('Las contraseñas no coinciden.');
    }

    connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      charset: 'utf8mb4'
    });

    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    if (existing.length > 0) {
      throw new Error(`El usuario "${username}" ya existe.`);
    }

    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
    await connection.execute(
      `INSERT INTO users (username, password_hash, role, active, must_change_password)
       VALUES (?, ?, 'admin', 1, 0)`,
      [username, passwordHash]
    );

    console.log(`\n✔ Usuario administrador "${username}" creado correctamente.`);
    console.log('  Inicia sesión en http://localhost:3000/admin\n');
  } catch (error) {
    console.error(`\n✖ ${friendlyDbError(error)}\n`);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }
}

main();
