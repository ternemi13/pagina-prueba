const { all, one, execute, withTransaction } = require('../db/pool');
const { badRequest, notFound, conflict } = require('../utils/errors');
const { parseDb, toDb, now } = require('../utils/datetime');
const { APPOINTMENT_SELECT } = require('./booking');

function normalizeBarberId(value) {
  if (value === null || value === undefined || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest('El barbero del bloqueo no es válido.');
  }
  return id;
}

function normalizeRange(start, end) {
  const startDate = parseDb(start);
  const endDate = parseDb(end);
  if (!startDate.isValid() || !endDate.isValid() || !startDate.isBefore(endDate)) {
    throw badRequest('El rango del bloqueo no es válido.');
  }
  return { startDate, endDate };
}

async function getBlockById(id, executor) {
  return one(
    `SELECT bl.id, bl.barber_id, b.name AS barber_name, bl.start_datetime,
            bl.end_datetime, bl.reason, bl.created_by, bl.created_at
     FROM blocks bl
     LEFT JOIN barbers b ON b.id = bl.barber_id
     WHERE bl.id = ?
     LIMIT 1`,
    [id],
    executor
  );
}

async function listBlocks({ includePast = false, barberId = null } = {}) {
  const where = [];
  const params = [];
  if (!includePast) {
    where.push('bl.end_datetime >= ?');
    params.push(toDb(now()));
  }
  if (barberId) {
    where.push('(bl.barber_id = ? OR bl.barber_id IS NULL)');
    params.push(barberId);
  }
  return all(
    `SELECT bl.id, bl.barber_id, b.name AS barber_name, bl.start_datetime,
            bl.end_datetime, bl.reason, bl.created_by, bl.created_at
     FROM blocks bl
     LEFT JOIN barbers b ON b.id = bl.barber_id
     ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY bl.start_datetime ASC`,
    params
  );
}

function mapAffected(row) {
  return {
    id: row.id,
    code: row.code,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    barber_name: row.barber_name,
    service_name: row.service_name,
    start_datetime: row.start_datetime,
    end_datetime: row.end_datetime,
    status: row.status
  };
}

async function previewAffected({ barberId = null, start, end }, executor) {
  const normalizedBarberId = normalizeBarberId(barberId);
  const { startDate, endDate } = normalizeRange(start, end);
  const params = [toDb(endDate), toDb(startDate)];
  let barberSql = '';
  if (normalizedBarberId) {
    barberSql = ' AND a.barber_id = ?';
    params.push(normalizedBarberId);
  }
  const rows = await all(
    `${APPOINTMENT_SELECT}
     WHERE a.status = 'confirmed'
       AND a.start_datetime < ?
       AND a.end_datetime > ? ${barberSql}
     ORDER BY a.start_datetime ASC`,
    params,
    executor
  );
  return rows.map(mapAffected);
}

async function createBlock({
  barberId = null,
  start,
  end,
  reason = null,
  createdBy = null,
  cancelAffected = false
}) {
  const normalizedBarberId = normalizeBarberId(barberId);
  const { startDate, endDate } = normalizeRange(start, end);
  const cleanReason = reason ? String(reason).trim().slice(0, 255) : null;

  return withTransaction(async (connection) => {
    if (normalizedBarberId) {
      const barber = await one(
        'SELECT id FROM barbers WHERE id = ? FOR UPDATE',
        [normalizedBarberId],
        connection
      );
      if (!barber) throw notFound('El barbero no existe.');
    } else {
      await all('SELECT id FROM barbers ORDER BY id ASC FOR UPDATE', [], connection);
    }

    const affectedParams = [toDb(endDate), toDb(startDate)];
    let barberSql = '';
    if (normalizedBarberId) {
      barberSql = ' AND a.barber_id = ?';
      affectedParams.push(normalizedBarberId);
    }

    const affected = await all(
      `${APPOINTMENT_SELECT}
       WHERE a.status = 'confirmed'
         AND a.start_datetime < ?
         AND a.end_datetime > ? ${barberSql}
       ORDER BY a.start_datetime ASC
       FOR UPDATE`,
      affectedParams,
      connection
    );

    if (affected.length > 0 && !cancelAffected) {
      throw conflict(
        'El bloqueo afecta citas existentes. Revisa la lista y confirma si deseas cancelarlas.',
        { affected: affected.map(mapAffected) }
      );
    }

    const cancelReason = `Bloqueo de agenda: ${cleanReason || 'sin motivo'}`;
    for (const appointment of affected) {
      await connection.execute(
        `UPDATE appointments
         SET status = 'cancelled', cancel_reason = ?, updated_at = ?
         WHERE id = ?`,
        [cancelReason, toDb(now()), appointment.id]
      );
      await connection.execute(
        'DELETE FROM appointment_slots WHERE appointment_id = ?',
        [appointment.id]
      );
      await connection.execute(
        `INSERT INTO appointment_events
          (appointment_id, event_type, description, created_by)
         VALUES (?, 'cancelled', ?, ?)`,
        [appointment.id, cancelReason, createdBy]
      );
    }

    const [result] = await connection.execute(
      `INSERT INTO blocks (barber_id, start_datetime, end_datetime, reason, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [normalizedBarberId, toDb(startDate), toDb(endDate), cleanReason, createdBy]
    );

    return {
      block: await getBlockById(result.insertId, connection),
      cancelledAppointments: affected.length
    };
  });
}

async function deleteBlock(id) {
  const block = await getBlockById(id);
  if (!block) throw notFound('El bloqueo no existe.');
  await execute('DELETE FROM blocks WHERE id = ?', [id]);
}

module.exports = {
  getBlockById,
  listBlocks,
  previewAffected,
  createBlock,
  deleteBlock
};
