const { all, one, execute, withTransaction } = require('../db/pool');
const { badRequest, notFound, conflict } = require('../utils/errors');
const { timeToMinutes, minutesToTime, toDb, now } = require('../utils/datetime');

function normalizeTime(value) {
  const minutes = timeToMinutes(String(value || '').slice(0, 5));
  if (minutes === null) return null;
  return `${minutesToTime(minutes)}:00`;
}

function validateHours(hours) {
  if (!Array.isArray(hours)) {
    throw badRequest('El horario del barbero no es válido.');
  }

  const byWeekday = new Map();
  for (const item of hours) {
    const weekday = Number(item.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw badRequest('El día de la semana no es válido.');
    }
    byWeekday.set(weekday, item);
  }

  const result = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const item = byWeekday.get(weekday);
    if (!item || item.closed) continue;

    const start = normalizeTime(item.start);
    const end = normalizeTime(item.end);
    if (!start || !end) {
      throw badRequest('Las horas de inicio y fin son obligatorias.');
    }
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (startMinutes >= endMinutes) {
      throw badRequest('La hora de inicio debe ser menor que la hora de fin.');
    }

    let breakStart = null;
    let breakEnd = null;
    if (item.breakStart || item.breakEnd) {
      breakStart = normalizeTime(item.breakStart);
      breakEnd = normalizeTime(item.breakEnd);
      if (!breakStart || !breakEnd) {
        throw badRequest('La pausa debe tener hora de inicio y fin.');
      }
      const breakStartMinutes = timeToMinutes(breakStart);
      const breakEndMinutes = timeToMinutes(breakEnd);
      if (breakStartMinutes >= breakEndMinutes) {
        throw badRequest('La pausa debe empezar antes de terminar.');
      }
      if (breakStartMinutes < startMinutes || breakEndMinutes > endMinutes) {
        throw badRequest('La pausa debe estar dentro del horario del barbero.');
      }
    }

    result.push({
      weekday,
      start,
      end,
      breakStart,
      breakEnd
    });
  }

  return result;
}

function validateServiceIds(serviceIds) {
  if (!Array.isArray(serviceIds)) {
    throw badRequest('Los servicios del barbero no son válidos.');
  }
  const ids = Array.from(new Set(serviceIds.map((id) => Number(id))));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw badRequest('Los servicios del barbero no son válidos.');
  }
  return ids;
}

async function getBarberRows(connection, includeInactive) {
  return all(
    `SELECT id, name, photo_url, bio, active, sort_order, created_at, updated_at
     FROM barbers
     ${includeInactive ? '' : 'WHERE active = 1'}
     ORDER BY sort_order ASC, id ASC`,
    [],
    connection
  );
}

async function hydrateBarbers(barbers, connection) {
  if (barbers.length === 0) return [];
  const ids = barbers.map((barber) => barber.id);
  const inIds = ids.map(() => '?').join(', ');

  const serviceRows = await all(
    `SELECT bs.barber_id, s.id, s.name, s.active
     FROM barber_services bs
     INNER JOIN services s ON s.id = bs.service_id
     WHERE bs.barber_id IN (${inIds})
     ORDER BY s.sort_order ASC, s.id ASC`,
    ids,
    connection
  );

  const hourRows = await all(
    `SELECT barber_id, weekday, start_time, end_time, break_start, break_end
     FROM working_hours
     WHERE barber_id IN (${inIds})
     ORDER BY barber_id ASC, weekday ASC`,
    ids,
    connection
  );

  const servicesByBarber = new Map(ids.map((id) => [id, []]));
  for (const row of serviceRows) {
    servicesByBarber.get(row.barber_id).push(row);
  }

  const hoursByBarber = new Map(ids.map((id) => [id, []]));
  for (const row of hourRows) {
    hoursByBarber.get(row.barber_id).push(row);
  }

  return barbers.map((barber) => {
    const services = servicesByBarber.get(barber.id) || [];
    return {
      ...barber,
      services,
      service_ids: services.map((service) => service.id),
      working_hours: hoursByBarber.get(barber.id) || []
    };
  });
}

async function listBarbers({ includeInactive = false } = {}) {
  const barbers = await getBarberRows(undefined, includeInactive);
  return hydrateBarbers(barbers);
}

async function getBarberById(id, { includeInactive = true } = {}, executor) {
  const barber = await one(
    `SELECT id, name, photo_url, bio, active, sort_order, created_at, updated_at
     FROM barbers
     WHERE id = ? ${includeInactive ? '' : 'AND active = 1'}
     LIMIT 1`,
    [id],
    executor
  );
  if (!barber) throw notFound('El barbero no existe.');
  const [hydrated] = await hydrateBarbers([barber], executor);
  return hydrated;
}

async function assertServicesExist(serviceIds, connection) {
  if (serviceIds.length === 0) return;
  const inIds = serviceIds.map(() => '?').join(', ');
  const rows = await all(
    `SELECT id FROM services WHERE id IN (${inIds})`,
    serviceIds,
    connection
  );
  if (rows.length !== serviceIds.length) {
    throw badRequest('Uno de los servicios seleccionados no existe.');
  }
}

async function replaceRelations(connection, barberId, serviceIds, hours) {
  await assertServicesExist(serviceIds, connection);

  await connection.execute('DELETE FROM barber_services WHERE barber_id = ?', [barberId]);
  for (const serviceId of serviceIds) {
    await connection.execute(
      'INSERT INTO barber_services (barber_id, service_id) VALUES (?, ?)',
      [barberId, serviceId]
    );
  }

  await connection.execute('DELETE FROM working_hours WHERE barber_id = ?', [barberId]);
  for (const hour of hours) {
    await connection.execute(
      `INSERT INTO working_hours
        (barber_id, weekday, start_time, end_time, break_start, break_end)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        barberId,
        hour.weekday,
        hour.start,
        hour.end,
        hour.breakStart,
        hour.breakEnd
      ]
    );
  }
}

async function createBarber(payload) {
  const name = String(payload.name || '').trim();
  if (name.length < 2 || name.length > 80) {
    throw badRequest('El nombre del barbero debe tener entre 2 y 80 caracteres.');
  }
  const serviceIds = validateServiceIds(payload.serviceIds || []);
  const hours = validateHours(payload.hours || []);

  return withTransaction(async (connection) => {
    const [result] = await connection.execute(
      `INSERT INTO barbers (name, photo_url, bio, active, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        payload.photoUrl || null,
        payload.bio || null,
        payload.active === false ? 0 : 1,
        Number(payload.sortOrder) || 0
      ]
    );
    await replaceRelations(connection, result.insertId, serviceIds, hours);
    return getBarberById(result.insertId, {}, connection);
  });
}

async function updateBarber(id, payload) {
  const name = String(payload.name || '').trim();
  if (name.length < 2 || name.length > 80) {
    throw badRequest('El nombre del barbero debe tener entre 2 y 80 caracteres.');
  }
  const serviceIds = validateServiceIds(payload.serviceIds || []);
  const hours = validateHours(payload.hours || []);

  return withTransaction(async (connection) => {
    const existing = await one(
      'SELECT id FROM barbers WHERE id = ? LIMIT 1',
      [id],
      connection
    );
    if (!existing) throw notFound('El barbero no existe.');

    await connection.execute(
      `UPDATE barbers
       SET name = ?, photo_url = ?, bio = ?, active = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
      [
        name,
        payload.photoUrl || null,
        payload.bio || null,
        payload.active === false ? 0 : 1,
        Number(payload.sortOrder) || 0,
        toDb(now()),
        id
      ]
    );
    await replaceRelations(connection, id, serviceIds, hours);
    return getBarberById(id, {}, connection);
  });
}

async function setBarberActive(id, active) {
  const barber = await one('SELECT id FROM barbers WHERE id = ? LIMIT 1', [id]);
  if (!barber) throw notFound('El barbero no existe.');
  await execute(
    'UPDATE barbers SET active = ?, updated_at = ? WHERE id = ?',
    [active ? 1 : 0, toDb(now()), id]
  );
  return getBarberById(id);
}

async function deleteBarber(id) {
  const appointments = await one(
    'SELECT COUNT(*) AS total FROM appointments WHERE barber_id = ?',
    [id]
  );
  if (Number(appointments.total) > 0) {
    throw conflict('No se puede eliminar un barbero con citas registradas. Desactívalo en su lugar.');
  }
  await execute('DELETE FROM barbers WHERE id = ?', [id]);
}

async function getPublicBarbers({ serviceId = null } = {}) {
  let barbers;
  if (serviceId) {
    barbers = await all(
      `SELECT b.id, b.name, b.photo_url, b.bio, b.sort_order
       FROM barbers b
       INNER JOIN barber_services bs ON bs.barber_id = b.id
       WHERE b.active = 1 AND bs.service_id = ?
       ORDER BY b.sort_order ASC, b.id ASC`,
      [serviceId]
    );
  } else {
    barbers = await all(
      `SELECT id, name, photo_url, bio, sort_order
       FROM barbers
       WHERE active = 1
       ORDER BY sort_order ASC, id ASC`
    );
  }
  return barbers;
}

module.exports = {
  listBarbers,
  getBarberById,
  createBarber,
  updateBarber,
  setBarberActive,
  deleteBarber,
  getPublicBarbers,
  validateHours
};
