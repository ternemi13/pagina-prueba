const { all, one, execute } = require('../db/pool');
const { badRequest, notFound, conflict } = require('../utils/errors');
const { getRules } = require('./settings');
const { toDb, now } = require('../utils/datetime');

function validatePayload(payload, rules) {
  const name = String(payload.name || '').trim();
  if (name.length < 2 || name.length > 100) {
    throw badRequest('El nombre del servicio debe tener entre 2 y 100 caracteres.');
  }

  const description = payload.description ? String(payload.description).trim() : null;
  if (description && description.length > 500) {
    throw badRequest('La descripción no puede superar 500 caracteres.');
  }

  const price = Number(payload.price);
  if (!Number.isInteger(price) || price < 0 || price > 100000000) {
    throw badRequest('El precio debe ser un número entero válido.');
  }

  const durationMinutes = Number(payload.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 480) {
    throw badRequest('La duración debe estar entre 1 y 480 minutos.');
  }
  if (durationMinutes % rules.slotIntervalMinutes !== 0) {
    throw badRequest(
      `La duración debe ser múltiplo del intervalo de slots (${rules.slotIntervalMinutes} minutos).`
    );
  }

  return {
    name,
    description,
    price,
    durationMinutes,
    active: payload.active === false ? 0 : 1,
    sortOrder: Number.isInteger(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0
  };
}

async function listServices({ includeInactive = false } = {}) {
  return all(
    `SELECT id, name, description, price, duration_minutes, active, sort_order,
            created_at, updated_at
     FROM services
     ${includeInactive ? '' : 'WHERE active = 1'}
     ORDER BY sort_order ASC, id ASC`
  );
}

async function getServiceById(id, { includeInactive = true } = {}) {
  const service = await one(
    `SELECT id, name, description, price, duration_minutes, active, sort_order,
            created_at, updated_at
     FROM services
     WHERE id = ? ${includeInactive ? '' : 'AND active = 1'}
     LIMIT 1`,
    [id]
  );
  if (!service) throw notFound('El servicio no existe.');
  return service;
}

async function createService(payload) {
  const rules = await getRules();
  const data = validatePayload(payload, rules);
  const result = await execute(
    `INSERT INTO services
      (name, description, price, duration_minutes, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.description,
      data.price,
      data.durationMinutes,
      data.active,
      data.sortOrder
    ]
  );
  return getServiceById(result.insertId);
}

async function updateService(id, payload) {
  const existing = await getServiceById(id);
  const rules = await getRules();
  const data = validatePayload(payload, rules);
  await execute(
    `UPDATE services
     SET name = ?, description = ?, price = ?, duration_minutes = ?,
         active = ?, sort_order = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.name,
      data.description,
      data.price,
      data.durationMinutes,
      data.active,
      data.sortOrder,
      toDb(now()),
      id
    ]
  );
  return getServiceById(existing.id);
}

async function setServiceActive(id, active) {
  await getServiceById(id);
  await execute(
    'UPDATE services SET active = ?, updated_at = ? WHERE id = ?',
    [active ? 1 : 0, toDb(now()), id]
  );
  return getServiceById(id);
}

async function deleteService(id) {
  await getServiceById(id);
  const appointments = await one(
    'SELECT COUNT(*) AS total FROM appointments WHERE service_id = ?',
    [id]
  );
  if (Number(appointments.total) > 0) {
    throw conflict(
      'No se puede eliminar un servicio con citas registradas. Desactívalo en su lugar.'
    );
  }
  await execute('DELETE FROM services WHERE id = ?', [id]);
}

async function getPublicServices() {
  return all(
    `SELECT id, name, description, price, duration_minutes, sort_order
     FROM services
     WHERE active = 1
     ORDER BY sort_order ASC, id ASC`
  );
}

module.exports = {
  listServices,
  getServiceById,
  createService,
  updateService,
  setServiceActive,
  deleteService,
  getPublicServices
};
