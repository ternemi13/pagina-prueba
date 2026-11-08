const bcrypt = require('bcryptjs');
const { all, one, execute } = require('../db/pool');
const { badRequest, unauthorized, tooManyRequests, notFound } = require('../utils/errors');
const { toDb, now, parseDb } = require('../utils/datetime');
const config = require('../config');

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    barber_id: row.barber_id,
    barberId: row.barber_id,
    mustChangePassword: Boolean(row.must_change_password)
  };
}

async function getFailureLock(username, ip) {
  const since = toDb(now().subtract(config.security.loginWindowMinutes, 'minute'));
  const [byUser, byIp] = await Promise.all([
    one(
      `SELECT COUNT(*) AS failures, MAX(attempted_at) AS last_failure
       FROM login_attempts
       WHERE success = 0 AND username = ? AND attempted_at >= ?`,
      [username, since]
    ),
    one(
      `SELECT COUNT(*) AS failures, MAX(attempted_at) AS last_failure
       FROM login_attempts
       WHERE success = 0 AND ip = ? AND attempted_at >= ?`,
      [ip, since]
    )
  ]);

  const lastFailures = [];
  if (Number(byUser.failures) >= config.security.loginMaxAttempts) {
    lastFailures.push(byUser.last_failure);
  }
  if (Number(byIp.failures) >= config.security.loginMaxAttempts) {
    lastFailures.push(byIp.last_failure);
  }
  if (lastFailures.length === 0) return null;

  const latest = lastFailures
    .map((value) => parseDb(value))
    .sort((a, b) => b.valueOf() - a.valueOf())[0];

  return latest.add(config.security.loginBlockMinutes, 'minute');
}

async function recordAttempt(username, ip, success) {
  await execute(
    `INSERT INTO login_attempts (username, ip, success)
     VALUES (?, ?, ?)`,
    [String(username || '').slice(0, 80), String(ip || '').slice(0, 64), success ? 1 : 0]
  );
}

async function authenticate({ username, password, ip }) {
  const cleanUsername = String(username || '').trim();
  const cleanIp = String(ip || '').slice(0, 64);

  const lockedUntil = await getFailureLock(cleanUsername, cleanIp);
  if (lockedUntil && lockedUntil.isAfter(now())) {
    const minutes = Math.max(1, Math.ceil(lockedUntil.diff(now(), 'minute', true)));
    throw tooManyRequests(
      `Demasiados intentos fallidos. Inténtalo de nuevo en ${minutes} minuto${minutes === 1 ? '' : 's'}.`
    );
  }

  const user = await one(
    `SELECT id, username, password_hash, role, barber_id, active, must_change_password
     FROM users
     WHERE username = ?
     LIMIT 1`,
    [cleanUsername]
  );

  const passwordHash = user ? user.password_hash : DUMMY_HASH;
  const passwordOk = await bcrypt.compare(String(password || ''), passwordHash);

  if (!user || !passwordOk || !user.active) {
    await recordAttempt(cleanUsername, cleanIp, false);
    throw unauthorized('Usuario o contraseña incorrectos.');
  }

  await recordAttempt(cleanUsername, cleanIp, true);
  await updateLastLogin(user.id);
  return normalizeUser(user);
}

async function getUserById(id) {
  const user = await one(
    `SELECT id, username, role, barber_id, active, must_change_password
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  if (!user || !user.active) return null;
  return normalizeUser(user);
}

async function getUserByUsername(username) {
  const user = await one(
    `SELECT id, username, role, barber_id, active, must_change_password
     FROM users
     WHERE username = ?
     LIMIT 1`,
    [String(username || '').trim()]
  );
  if (!user || !user.active) return null;
  return normalizeUser(user);
}

async function changePassword({ userId, currentPassword, newPassword }) {
  if (!newPassword || String(newPassword).length < 8) {
    throw badRequest('La nueva contraseña debe tener al menos 8 caracteres.');
  }
  if (String(newPassword).length > 128) {
    throw badRequest('La nueva contraseña es demasiado larga.');
  }

  const user = await one(
    'SELECT id, password_hash FROM users WHERE id = ? AND active = 1 LIMIT 1',
    [userId]
  );
  if (!user) throw unauthorized('Sesión no válida.');

  const valid = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
  if (!valid) {
    throw badRequest('La contraseña actual no es correcta.');
  }

  const hash = await bcrypt.hash(String(newPassword), config.security.bcryptRounds);
  await execute(
    `UPDATE users
     SET password_hash = ?, must_change_password = 0, updated_at = ?
     WHERE id = ?`,
    [hash, toDb(now()), userId]
  );
}

async function hashPassword(password) {
  return bcrypt.hash(String(password), config.security.bcryptRounds);
}

async function createUser({
  username,
  password,
  role = 'admin',
  barberId = null,
  mustChangePassword = false
}) {
  const cleanUsername = String(username || '').trim();
  if (cleanUsername.length < 3 || cleanUsername.length > 80) {
    throw badRequest('El usuario debe tener entre 3 y 80 caracteres.');
  }
  if (!['admin', 'barber'].includes(role)) {
    throw badRequest('El rol no es válido.');
  }
  if (role === 'barber' && !barberId) {
    throw badRequest('Un usuario de barbero debe estar vinculado a un barbero.');
  }
  if (String(password || '').length < 8) {
    throw badRequest('La contraseña debe tener al menos 8 caracteres.');
  }

  const existing = await one('SELECT id FROM users WHERE username = ? LIMIT 1', [cleanUsername]);
  if (existing) {
    throw badRequest('Ya existe un usuario con ese nombre.');
  }

  const hash = await hashPassword(password);
  const result = await execute(
    `INSERT INTO users
      (username, password_hash, role, barber_id, active, must_change_password)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [cleanUsername, hash, role, barberId, mustChangePassword ? 1 : 0]
  );
  return getUserById(result.insertId);
}

async function listUsers() {
  return all(
    `SELECT u.id, u.username, u.role, u.barber_id, b.name AS barber_name,
            u.active, u.must_change_password, u.last_login_at, u.created_at
     FROM users u
     LEFT JOIN barbers b ON b.id = u.barber_id
     ORDER BY u.id ASC`
  );
}

async function setUserActive(id, active) {
  const user = await one('SELECT id FROM users WHERE id = ? LIMIT 1', [id]);
  if (!user) throw notFound('El usuario no existe.');
  await execute(
    'UPDATE users SET active = ?, updated_at = ? WHERE id = ?',
    [active ? 1 : 0, toDb(now()), id]
  );
  return { id: Number(id), active: Boolean(active) };
}

async function updateLastLogin(id) {
  await execute('UPDATE users SET last_login_at = ? WHERE id = ?', [toDb(now()), id]);
}

module.exports = {
  authenticate,
  getUserById,
  getUserByUsername,
  changePassword,
  hashPassword,
  createUser,
  listUsers,
  setUserActive,
  updateLastLogin,
  normalizeUser
};
