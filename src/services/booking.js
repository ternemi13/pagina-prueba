const { withTransaction, all, one } = require('../db/pool');
const {
  AppError,
  badRequest,
  conflict,
  notFound,
  forbidden
} = require('../utils/errors');
const { normalizePhone } = require('../utils/phone');
const { generateCode } = require('../utils/codes');
const {
  getAllSettings,
  getRules,
  buildRules
} = require('./settings');
const {
  getService,
  getEligibleBarbers,
  getBarberForService,
  getAvailabilityForBarber
} = require('./availability-db');
const {
  validatePaymentMethod,
  getPaymentMethodLabel,
  getPaymentStatusLabel
} = require('./payments');
const {
  now,
  parseLocal,
  parseDb,
  toDb,
  slotStarts,
  startOfWeek,
  today
} = require('../utils/datetime');

const APPOINTMENT_SELECT = `
  SELECT
    a.id,
    a.code,
    a.barber_id,
    b.name AS barber_name,
    a.service_id,
    s.name AS service_name,
    a.start_datetime,
    a.end_datetime,
    a.price_at_booking,
    a.customer_name,
    a.customer_phone,
    a.customer_email,
    a.notes,
    a.status,
    a.payment_method,
    a.payment_status,
    a.cancel_reason,
    a.created_at,
    a.updated_at
  FROM appointments a
  INNER JOIN barbers b ON b.id = a.barber_id
  INNER JOIN services s ON s.id = a.service_id
`;

const STATUS_LABELS = {
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió'
};

function assertBarberAccess(row, user) {
  if (!row) throw notFound('Cita no encontrada.');
  if (user && user.role === 'barber') {
    if (!user.barber_id || Number(row.barber_id) !== Number(user.barber_id)) {
      throw notFound('Cita no encontrada.');
    }
  }
}

function canCancelAppointment(row, rules) {
  if (!row || row.status !== 'confirmed') return false;
  const start = parseDb(row.start_datetime);
  return start.diff(now(), 'minute') >= rules.cancelMinHours * 60;
}

function toPublicAppointment(row, rules, settings) {
  return {
    code: row.code,
    status: row.status,
    status_label: STATUS_LABELS[row.status] || row.status,
    payment_method: row.payment_method,
    payment_method_label: getPaymentMethodLabel(row.payment_method, settings),
    payment_status: row.payment_status,
    payment_status_label: getPaymentStatusLabel(row.payment_status),
    start_datetime: row.start_datetime,
    end_datetime: row.end_datetime,
    price: row.price_at_booking,
    service_name: row.service_name,
    barber_name: row.barber_name,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    notes: row.notes,
    cancel_reason: row.cancel_reason,
    can_cancel: canCancelAppointment(row, rules),
    cancel_min_hours: rules.cancelMinHours
  };
}

async function getAppointmentById(id, executor) {
  return one(`${APPOINTMENT_SELECT} WHERE a.id = ? LIMIT 1`, [id], executor);
}

async function uniqueCode(connection, prefix) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = generateCode(prefix);
    const existing = await one(
      'SELECT id FROM appointments WHERE code = ? LIMIT 1',
      [code],
      connection
    );
    if (!existing) return code;
  }
  throw new AppError(500, 'No se pudo generar el código de la reserva.', {
    code: 'CODE_GENERATION_FAILED'
  });
}

async function insertSlots(connection, barberId, start, durationMinutes, intervalMinutes, appointmentId) {
  const starts = slotStarts(start, durationMinutes, intervalMinutes);
  for (const slot of starts) {
    try {
      await connection.execute(
        'INSERT INTO appointment_slots (barber_id, slot_start, appointment_id) VALUES (?, ?, ?)',
        [barberId, toDb(slot), appointmentId]
      );
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        throw conflict('Esa hora ya fue tomada, elige otra.');
      }
      throw error;
    }
  }
}

async function logEvent(connection, appointmentId, type, description, userId = null) {
  await connection.execute(
    `INSERT INTO appointment_events (appointment_id, event_type, description, created_by)
     VALUES (?, ?, ?, ?)`,
    [appointmentId, type, description, userId]
  );
}

async function createAppointment(input) {
  const {
    serviceId,
    barberId = 'any',
    date,
    time,
    customerName,
    customerPhone,
    customerEmail = null,
    notes = null,
    paymentMethod = 'cash_on_site',
    paymentStatus = 'pending',
    createdByUserId = null,
    source = 'public'
  } = input;

  const phone = normalizePhone(customerPhone);
  if (!phone) {
    throw badRequest('Escribe un teléfono colombiano de 10 dígitos.');
  }
  const name = String(customerName || '').trim();
  if (name.length < 2 || name.length > 100) {
    throw badRequest('El nombre del cliente no es válido.');
  }
  if (!['pending', 'paid'].includes(paymentStatus)) {
    throw badRequest('El estado de pago no es válido.');
  }

  const start = parseLocal(date, time);
  if (!start.isValid()) {
    throw badRequest('La fecha u hora de la cita no es válida.');
  }

  return withTransaction(async (connection) => {
    const settings = await getAllSettings(connection);
    const rules = buildRules(settings);
    const service = await getService(serviceId, connection);
    validatePaymentMethod(paymentMethod, settings);

    const candidates =
      barberId === 'any'
        ? await getEligibleBarbers(serviceId, 'any', connection)
        : [await getBarberForService(serviceId, barberId, connection)];

    if (candidates.length === 0) {
      throw conflict('No hay barberos disponibles para ese servicio.');
    }

    for (const candidate of candidates) {
      const locked = await one(
        'SELECT id FROM barbers WHERE id = ? AND active = 1 FOR UPDATE',
        [candidate.id],
        connection
      );
      if (!locked) continue;

      let availability;
      try {
        availability = await getAvailabilityForBarber({
          serviceId,
          barberId: candidate.id,
          date,
          connection
        });
      } catch (error) {
        if (barberId === 'any') continue;
        throw error;
      }

      if (!availability.times.includes(time)) {
        if (barberId === 'any') continue;
        throw conflict('Esa hora ya fue tomada, elige otra.');
      }

      const code = await uniqueCode(connection, settings.business_code_prefix);
      const end = start.add(service.duration_minutes, 'minute');
      const [result] = await connection.execute(
        `INSERT INTO appointments
          (code, barber_id, service_id, start_datetime, end_datetime, price_at_booking,
           customer_name, customer_phone, customer_email, notes, status, payment_method,
           payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
        [
          code,
          candidate.id,
          serviceId,
          toDb(start),
          toDb(end),
          service.price,
          name,
          phone,
          customerEmail || null,
          notes || null,
          paymentMethod,
          paymentStatus
        ]
      );

      const appointmentId = result.insertId;
      await insertSlots(
        connection,
        candidate.id,
        start,
        service.duration_minutes,
        rules.slotIntervalMinutes,
        appointmentId
      );

      await logEvent(
        connection,
        appointmentId,
        'created',
        source === 'admin' ? 'Cita creada desde el panel.' : 'Cita creada por el cliente.',
        createdByUserId
      );

      if (paymentStatus === 'paid') {
        await logEvent(
          connection,
          appointmentId,
          'payment_status_changed',
          'Pago confirmado.',
          createdByUserId
        );
      }

      const row = await getAppointmentById(appointmentId, connection);
      return {
        appointment: row,
        public: toPublicAppointment(row, rules, settings),
        rules
      };
    }

    throw conflict('Esa hora ya fue tomada, elige otra.');
  });
}

async function lookupAppointment({ code, phone }) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw badRequest('Escribe un teléfono colombiano de 10 dígitos.');
  }
  const row = await one(
    `${APPOINTMENT_SELECT} WHERE a.code = ? AND a.customer_phone = ? LIMIT 1`,
    [code, normalized]
  );
  if (!row) {
    throw notFound('No encontramos una cita con ese código y teléfono.');
  }
  const settings = await getAllSettings();
  const rules = buildRules(settings);
  return toPublicAppointment(row, rules, settings);
}

async function cancelAppointmentByClient({ code, phone, reason = null }) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw badRequest('Escribe un teléfono colombiano de 10 dígitos.');
  }

  return withTransaction(async (connection) => {
    const row = await one(
      `${APPOINTMENT_SELECT} WHERE a.code = ? AND a.customer_phone = ? FOR UPDATE`,
      [code, normalized],
      connection
    );
    if (!row) {
      throw notFound('No encontramos una cita con ese código y teléfono.');
    }
    if (row.status !== 'confirmed') {
      throw conflict('Esta cita ya no se puede cancelar.');
    }

    const settings = await getAllSettings(connection);
    const rules = buildRules(settings);
    const start = parseDb(row.start_datetime);
    if (start.diff(now(), 'minute') < rules.cancelMinHours * 60) {
      throw badRequest(
        `Solo puedes cancelar con al menos ${rules.cancelMinHours} horas de anticipación.`
      );
    }

    await one(
      'SELECT id FROM barbers WHERE id = ? FOR UPDATE',
      [row.barber_id],
      connection
    );

    const cancelReason = reason ? String(reason).slice(0, 255) : 'Cancelada por el cliente.';
    await connection.execute(
      `UPDATE appointments
       SET status = 'cancelled', cancel_reason = ?, updated_at = ?
       WHERE id = ?`,
      [cancelReason, toDb(now()), row.id]
    );
    await connection.execute(
      'DELETE FROM appointment_slots WHERE appointment_id = ?',
      [row.id]
    );
    await logEvent(connection, row.id, 'cancelled', cancelReason, null);

    const updated = await getAppointmentById(row.id, connection);
    return toPublicAppointment(updated, rules, settings);
  });
}

async function cancelAppointmentByAdmin({ id, reason, user }) {
  return withTransaction(async (connection) => {
    const row = await one(
      `${APPOINTMENT_SELECT} WHERE a.id = ? FOR UPDATE`,
      [id],
      connection
    );
    assertBarberAccess(row, user);
    if (row.status !== 'confirmed') {
      throw conflict('Solo se pueden cancelar citas confirmadas.');
    }

    await one(
      'SELECT id FROM barbers WHERE id = ? FOR UPDATE',
      [row.barber_id],
      connection
    );

    const cancelReason = reason
      ? String(reason).slice(0, 255)
      : 'Cancelada por administración.';
    await connection.execute(
      `UPDATE appointments
       SET status = 'cancelled', cancel_reason = ?, updated_at = ?
       WHERE id = ?`,
      [cancelReason, toDb(now()), row.id]
    );
    await connection.execute(
      'DELETE FROM appointment_slots WHERE appointment_id = ?',
      [row.id]
    );
    await logEvent(connection, row.id, 'cancelled', cancelReason, user.id);

    return getAppointmentById(row.id, connection);
  });
}

async function updateAppointmentStatus({ id, status, user }) {
  if (!['completed', 'no_show'].includes(status)) {
    throw badRequest('El estado de la cita no es válido.');
  }

  return withTransaction(async (connection) => {
    const row = await one(
      `${APPOINTMENT_SELECT} WHERE a.id = ? FOR UPDATE`,
      [id],
      connection
    );
    assertBarberAccess(row, user);
    if (row.status !== 'confirmed') {
      throw conflict('Solo se pueden actualizar citas confirmadas.');
    }

    await connection.execute(
      'UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?',
      [status, toDb(now()), id]
    );
    await logEvent(
      connection,
      id,
      'status_changed',
      status === 'completed' ? 'Cita completada.' : 'Cliente no asistió.',
      user.id
    );

    return getAppointmentById(id, connection);
  });
}

async function markAppointmentPaid({ id, user }) {
  return withTransaction(async (connection) => {
    const row = await one(
      `${APPOINTMENT_SELECT} WHERE a.id = ? FOR UPDATE`,
      [id],
      connection
    );
    assertBarberAccess(row, user);
    if (row.status === 'cancelled') {
      throw conflict('No se puede marcar como pagada una cita cancelada.');
    }
    if (row.payment_status === 'paid') {
      return getAppointmentById(id, connection);
    }

    await connection.execute(
      'UPDATE appointments SET payment_status = ?, updated_at = ? WHERE id = ?',
      ['paid', toDb(now()), id]
    );
    await logEvent(connection, id, 'payment_status_changed', 'Pago confirmado.', user.id);

    return getAppointmentById(id, connection);
  });
}

async function updateAppointmentNotes({ id, notes, user }) {
  return withTransaction(async (connection) => {
    const row = await one(
      `${APPOINTMENT_SELECT} WHERE a.id = ? FOR UPDATE`,
      [id],
      connection
    );
    assertBarberAccess(row, user);

    const cleanNotes = notes ? String(notes).slice(0, 500) : null;
    await connection.execute(
      'UPDATE appointments SET notes = ?, updated_at = ? WHERE id = ?',
      [cleanNotes, toDb(now()), id]
    );
    await logEvent(connection, id, 'notes_updated', 'Notas de la cita actualizadas.', user.id);

    return getAppointmentById(id, connection);
  });
}

async function rescheduleAppointment({ id, date, time, barberId, user }) {
  return withTransaction(async (connection) => {
    const row = await one(
      `${APPOINTMENT_SELECT} WHERE a.id = ? FOR UPDATE`,
      [id],
      connection
    );
    assertBarberAccess(row, user);
    if (row.status !== 'confirmed') {
      throw conflict('Solo se pueden reprogramar citas confirmadas.');
    }

    const service = await getService(row.service_id, connection);
    const newBarberId = barberId || row.barber_id;
    const newBarber = await getBarberForService(
      row.service_id,
      newBarberId,
      connection
    );

    const lockIds = Array.from(
      new Set([Number(row.barber_id), Number(newBarber.id)])
    ).sort((a, b) => a - b);
    for (const lockId of lockIds) {
      await one('SELECT id FROM barbers WHERE id = ? FOR UPDATE', [lockId], connection);
    }

    const availability = await getAvailabilityForBarber({
      serviceId: row.service_id,
      barberId: newBarber.id,
      date,
      connection,
      excludeAppointmentId: id
    });

    if (!availability.times.includes(time)) {
      throw conflict('Esa hora ya fue tomada, elige otra.');
    }

    const rules = await getRules(connection);
    const newStart = parseLocal(date, time);
    const newEnd = newStart.add(service.duration_minutes, 'minute');

    await connection.execute(
      'DELETE FROM appointment_slots WHERE appointment_id = ?',
      [id]
    );
    await connection.execute(
      `UPDATE appointments
       SET barber_id = ?, start_datetime = ?, end_datetime = ?, updated_at = ?
       WHERE id = ?`,
      [newBarber.id, toDb(newStart), toDb(newEnd), toDb(now()), id]
    );
    await insertSlots(
      connection,
      newBarber.id,
      newStart,
      service.duration_minutes,
      rules.slotIntervalMinutes,
      id
    );

    await logEvent(
      connection,
      id,
      'rescheduled',
      `Reprogramada de ${row.barber_name} ${row.start_datetime} a ${newBarber.name} ${toDb(newStart)}.`,
      user.id
    );

    return getAppointmentById(id, connection);
  });
}

function buildFilters(filters, user) {
  const where = [];
  const params = [];

  if (user && user.role === 'barber') {
    if (!user.barber_id) {
      throw forbidden('Este usuario no está vinculado a un barbero.');
    }
    where.push('a.barber_id = ?');
    params.push(user.barber_id);
  } else if (filters.barberId) {
    where.push('a.barber_id = ?');
    params.push(filters.barberId);
  }

  if (filters.dateFrom) {
    where.push('a.start_datetime >= ?');
    params.push(toDb(parseLocal(filters.dateFrom, '00:00')));
  }
  if (filters.dateTo) {
    where.push('a.start_datetime < ?');
    params.push(toDb(parseLocal(filters.dateTo, '00:00').add(1, 'day')));
  }
  if (filters.status) {
    where.push('a.status = ?');
    params.push(filters.status);
  }
  if (filters.paymentStatus) {
    where.push('a.payment_status = ?');
    params.push(filters.paymentStatus);
  }
  if (filters.search) {
    where.push('(a.code LIKE ? OR a.customer_name LIKE ? OR a.customer_phone LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  return {
    where: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

async function listAppointments(filters, user, limit = 500) {
  const { where, params } = buildFilters(filters, user);
  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 10000);
  return all(
    `${APPOINTMENT_SELECT} ${where}
     ORDER BY a.start_datetime DESC, a.id DESC
     LIMIT ${safeLimit}`,
    params
  );
}

async function getAppointmentDetail({ id, user }) {
  const row = await getAppointmentById(id);
  assertBarberAccess(row, user);
  const events = await all(
    `SELECT e.id, e.event_type, e.description, e.created_at, u.username
     FROM appointment_events e
     LEFT JOIN users u ON u.id = e.created_by
     WHERE e.appointment_id = ?
     ORDER BY e.created_at ASC, e.id ASC`,
    [id]
  );
  return { appointment: row, events };
}

async function getDashboard(user) {
  const barberWhere =
    user && user.role === 'barber'
      ? (() => {
          if (!user.barber_id) {
            throw forbidden('Este usuario no está vinculado a un barbero.');
          }
          return { sql: 'AND a.barber_id = ?', params: [user.barber_id] };
        })()
      : { sql: '', params: [] };

  const referenceNow = now();
  const todayStart = today();
  const todayEnd = todayStart.add(1, 'day');
  const weekStart = startOfWeek(referenceNow);
  const weekEnd = weekStart.add(7, 'day');
  const nowDb = toDb(referenceNow);

  const todayAppointments = await all(
    `${APPOINTMENT_SELECT}
     WHERE a.start_datetime >= ? AND a.start_datetime < ?
       AND a.status <> 'cancelled' ${barberWhere.sql}
     ORDER BY a.start_datetime ASC`,
    [toDb(todayStart), toDb(todayEnd), ...barberWhere.params]
  );

  const upcoming = await all(
    `${APPOINTMENT_SELECT}
     WHERE a.start_datetime >= ? AND a.status = 'confirmed' ${barberWhere.sql}
     ORDER BY a.start_datetime ASC
     LIMIT 8`,
    [nowDb, ...barberWhere.params]
  );

  const statsRow = await one(
    `SELECT
       SUM(CASE WHEN a.start_datetime >= ? AND a.start_datetime < ? AND a.status <> 'cancelled' THEN 1 ELSE 0 END) AS today_count,
       SUM(CASE WHEN a.start_datetime >= ? AND a.start_datetime < ? AND a.status = 'confirmed' THEN 1 ELSE 0 END) AS today_confirmed,
       SUM(CASE WHEN a.start_datetime >= ? AND a.start_datetime < ? AND a.status <> 'cancelled' THEN 1 ELSE 0 END) AS week_count,
       SUM(CASE WHEN a.start_datetime >= ? AND a.start_datetime < ? AND a.payment_status = 'paid' AND a.status <> 'cancelled' THEN a.price_at_booking ELSE 0 END) AS revenue_today,
       SUM(CASE WHEN a.start_datetime >= ? AND a.start_datetime < ? AND a.payment_status = 'paid' AND a.status <> 'cancelled' THEN a.price_at_booking ELSE 0 END) AS revenue_week
     FROM appointments a
     WHERE 1 = 1 ${barberWhere.sql}`,
    [
      toDb(todayStart),
      toDb(todayEnd),
      toDb(todayStart),
      toDb(todayEnd),
      toDb(weekStart),
      toDb(weekEnd),
      toDb(todayStart),
      toDb(todayEnd),
      toDb(weekStart),
      toDb(weekEnd),
      ...barberWhere.params
    ]
  );

  return {
    stats: {
      todayCount: Number(statsRow.today_count || 0),
      todayConfirmed: Number(statsRow.today_confirmed || 0),
      weekCount: Number(statsRow.week_count || 0),
      revenueToday: Number(statsRow.revenue_today || 0),
      revenueWeek: Number(statsRow.revenue_week || 0)
    },
    todayAppointments,
    upcoming
  };
}

async function getCalendar({ start, end, barberId, user }) {
  const rangeStart = parseLocal(start, '00:00');
  const rangeEnd = parseLocal(end, '00:00').add(1, 'day');
  const where = ['a.start_datetime < ?', 'a.end_datetime > ?'];
  const params = [toDb(rangeEnd), toDb(rangeStart)];

  if (user && user.role === 'barber') {
    if (!user.barber_id) {
      throw forbidden('Este usuario no está vinculado a un barbero.');
    }
    where.push('a.barber_id = ?');
    params.push(user.barber_id);
  } else if (barberId) {
    where.push('a.barber_id = ?');
    params.push(barberId);
  }

  const appointments = await all(
    `${APPOINTMENT_SELECT}
     WHERE ${where.join(' AND ')}
     ORDER BY a.start_datetime ASC`,
    params
  );

  const blockWhere = ['bl.start_datetime < ?', 'bl.end_datetime > ?'];
  const blockParams = [toDb(rangeEnd), toDb(rangeStart)];

  if (user && user.role === 'barber') {
    if (!user.barber_id) {
      throw forbidden('Este usuario no está vinculado a un barbero.');
    }
    blockWhere.push('(bl.barber_id = ? OR bl.barber_id IS NULL)');
    blockParams.push(user.barber_id);
  } else if (barberId) {
    blockWhere.push('(bl.barber_id = ? OR bl.barber_id IS NULL)');
    blockParams.push(barberId);
  }

  const blocks = await all(
    `SELECT bl.id, bl.barber_id, b.name AS barber_name, bl.start_datetime,
            bl.end_datetime, bl.reason, bl.created_at
     FROM blocks bl
     LEFT JOIN barbers b ON b.id = bl.barber_id
     WHERE ${blockWhere.join(' AND ')}
     ORDER BY bl.start_datetime ASC`,
    blockParams
  );

  return { appointments, blocks };
}

async function exportAppointments(filters, user) {
  return listAppointments(filters, user, 10000);
}

module.exports = {
  STATUS_LABELS,
  APPOINTMENT_SELECT,
  assertBarberAccess,
  canCancelAppointment,
  toPublicAppointment,
  createAppointment,
  lookupAppointment,
  cancelAppointmentByClient,
  cancelAppointmentByAdmin,
  updateAppointmentStatus,
  markAppointmentPaid,
  updateAppointmentNotes,
  rescheduleAppointment,
  listAppointments,
  getAppointmentDetail,
  getDashboard,
  getCalendar,
  exportAppointments
};
