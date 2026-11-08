const { all, one } = require('../db/pool');
const { notFound } = require('../utils/errors');
const {
  now,
  parseLocal,
  toDb,
  weekdayOf,
  dateList,
  endOfMonth
} = require('../utils/datetime');
const { getRules, getBusinessHours } = require('./settings');
const {
  getAvailableStartTimes
} = require('./availability');

function placeholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

async function getService(serviceId, connection) {
  const service = await one(
    `SELECT id, name, description, price, duration_minutes, active, sort_order
     FROM services WHERE id = ? LIMIT 1`,
    [serviceId],
    connection
  );
  if (!service || !service.active) {
    throw notFound('El servicio no existe o no está disponible.');
  }
  return service;
}

async function getEligibleBarbers(serviceId, barberId, connection) {
  if (barberId === 'any') {
    return all(
      `SELECT b.id, b.name, b.photo_url, b.bio, b.sort_order
       FROM barbers b
       INNER JOIN barber_services bs ON bs.barber_id = b.id
       WHERE b.active = 1 AND bs.service_id = ?
       ORDER BY b.sort_order ASC, b.id ASC`,
      [serviceId],
      connection
    );
  }

  return all(
    `SELECT b.id, b.name, b.photo_url, b.bio, b.sort_order
     FROM barbers b
     INNER JOIN barber_services bs ON bs.barber_id = b.id
     WHERE b.active = 1 AND b.id = ? AND bs.service_id = ?
     LIMIT 1`,
    [barberId, serviceId],
    connection
  );
}

async function getBarberForService(serviceId, barberId, connection) {
  const barbers = await getEligibleBarbers(serviceId, barberId, connection);
  if (barbers.length === 0) {
    throw notFound('El barbero no existe, no está disponible o no ofrece ese servicio.');
  }
  return barbers[0];
}

function normalizeWorkingHours(row) {
  if (!row) return null;
  return {
    start: row.start ?? row.start_time,
    end: row.end ?? row.end_time,
    break_start: row.break_start ?? null,
    break_end: row.break_end ?? null
  };
}

async function getWorkingHours(barberId, weekday, connection) {
  const row = await one(
    `SELECT start_time, end_time, break_start, break_end
     FROM working_hours
     WHERE barber_id = ? AND weekday = ?
     LIMIT 1`,
    [barberId, weekday],
    connection
  );
  return normalizeWorkingHours(row);
}

async function getBlocksForDay(barberId, date, connection) {
  const dayStart = parseLocal(date, '00:00');
  const dayEnd = dayStart.add(1, 'day');
  return all(
    `SELECT start_datetime, end_datetime
     FROM blocks
     WHERE (barber_id = ? OR barber_id IS NULL)
       AND start_datetime < ?
       AND end_datetime > ?
     ORDER BY start_datetime ASC`,
    [barberId, toDb(dayEnd), toDb(dayStart)],
    connection
  );
}

async function getAppointmentsForDay(
  barberId,
  date,
  connection,
  excludeAppointmentId = null
) {
  const dayStart = parseLocal(date, '00:00');
  const dayEnd = dayStart.add(1, 'day');
  const params = [barberId, toDb(dayEnd), toDb(dayStart)];
  let excludeSql = '';
  if (excludeAppointmentId) {
    excludeSql = ' AND id <> ?';
    params.push(excludeAppointmentId);
  }
  return all(
    `SELECT id, start_datetime, end_datetime
     FROM appointments
     WHERE barber_id = ?
       AND status <> 'cancelled'
       AND start_datetime < ?
       AND end_datetime > ?
       ${excludeSql}
     ORDER BY start_datetime ASC`,
    params,
    connection
  );
}

async function getAvailabilityForBarber({
  serviceId,
  barberId,
  date,
  connection,
  excludeAppointmentId = null
}) {
  const service = await getService(serviceId, connection);
  const barber = await getBarberForService(serviceId, barberId, connection);
  const rules = await getRules(connection);
  const businessHours = await getBusinessHours(connection);
  const weekday = weekdayOf(date);
  const workingHours = await getWorkingHours(barber.id, weekday, connection);
  const blocks = await getBlocksForDay(barber.id, date, connection);
  const appointments = await getAppointmentsForDay(
    barber.id,
    date,
    connection,
    excludeAppointmentId
  );

  const times = getAvailableStartTimes({
    date,
    serviceDuration: service.duration_minutes,
    intervalMinutes: rules.slotIntervalMinutes,
    businessHours: businessHours[weekday],
    workingHours,
    blocks: blocks.map((block) => ({
      start: block.start_datetime,
      end: block.end_datetime
    })),
    appointments: appointments.map((appointment) => ({
      start: appointment.start_datetime,
      end: appointment.end_datetime
    })),
    now: now(),
    minAdvanceMinutes: rules.minAdvanceMinutes,
    maxAdvanceDays: rules.maxAdvanceDays
  });

  return {
    service,
    barber,
    times,
    rules,
    businessHours,
    workingHours,
    blocks,
    appointments
  };
}

async function getAvailability({
  serviceId,
  barberId,
  date,
  connection,
  excludeAppointmentId = null
}) {
  const service = await getService(serviceId, connection);
  const barbers = await getEligibleBarbers(serviceId, barberId, connection);
  if (barbers.length === 0) {
    throw notFound('No hay barberos disponibles para ese servicio.');
  }

  const rules = await getRules(connection);
  const businessHours = await getBusinessHours(connection);
  const weekday = weekdayOf(date);
  const union = new Set();
  const barberResults = [];

  for (const barber of barbers) {
    const workingHours = await getWorkingHours(barber.id, weekday, connection);
    const blocks = await getBlocksForDay(barber.id, date, connection);
    const appointments = await getAppointmentsForDay(
      barber.id,
      date,
      connection,
      excludeAppointmentId
    );

    const times = getAvailableStartTimes({
      date,
      serviceDuration: service.duration_minutes,
      intervalMinutes: rules.slotIntervalMinutes,
      businessHours: businessHours[weekday],
      workingHours,
      blocks: blocks.map((block) => ({
        start: block.start_datetime,
        end: block.end_datetime
      })),
      appointments: appointments.map((appointment) => ({
        start: appointment.start_datetime,
        end: appointment.end_datetime
      })),
      now: now(),
      minAdvanceMinutes: rules.minAdvanceMinutes,
      maxAdvanceDays: rules.maxAdvanceDays
    });

    times.forEach((time) => union.add(time));
    barberResults.push({
      id: barber.id,
      name: barber.name,
      photo_url: barber.photo_url,
      bio: barber.bio,
      times
    });
  }

  return {
    date,
    service,
    barbers: barberResults,
    times: Array.from(union).sort(),
    rules
  };
}

async function getAvailableDays({
  serviceId,
  barberId,
  month,
  connection
}) {
  const service = await getService(serviceId, connection);
  const barbers = await getEligibleBarbers(serviceId, barberId, connection);
  if (barbers.length === 0) {
    throw notFound('No hay barberos disponibles para ese servicio.');
  }

  const rules = await getRules(connection);
  const businessHours = await getBusinessHours(connection);
  const firstDate = `${month}-01`;
  const lastDate = endOfMonth(firstDate).format('YYYY-MM-DD');
  const rangeStart = parseLocal(firstDate, '00:00');
  const rangeEnd = parseLocal(lastDate, '00:00').add(1, 'day');
  const barberIds = barbers.map((barber) => barber.id);
  const inBarbers = placeholders(barberIds.length);

  const workingRows = await all(
    `SELECT barber_id, weekday, start_time, end_time, break_start, break_end
     FROM working_hours
     WHERE barber_id IN (${inBarbers})`,
    barberIds,
    connection
  );

  const blockRows = await all(
    `SELECT barber_id, start_datetime, end_datetime
     FROM blocks
     WHERE (barber_id IN (${inBarbers}) OR barber_id IS NULL)
       AND start_datetime < ?
       AND end_datetime > ?`,
    [...barberIds, toDb(rangeEnd), toDb(rangeStart)],
    connection
  );

  const appointmentRows = await all(
    `SELECT barber_id, start_datetime, end_datetime
     FROM appointments
     WHERE barber_id IN (${inBarbers})
       AND status <> 'cancelled'
       AND start_datetime < ?
       AND end_datetime > ?`,
    [...barberIds, toDb(rangeEnd), toDb(rangeStart)],
    connection
  );

  const workingByBarberWeekday = new Map();
  for (const row of workingRows) {
    workingByBarberWeekday.set(
      `${row.barber_id}-${row.weekday}`,
      normalizeWorkingHours(row)
    );
  }

  const blocksByBarber = new Map(barberIds.map((id) => [id, []]));
  for (const block of blockRows) {
    if (block.barber_id === null) {
      for (const id of barberIds) {
        blocksByBarber.get(id).push({
          start: block.start_datetime,
          end: block.end_datetime
        });
      }
    } else {
      const list = blocksByBarber.get(block.barber_id);
      if (list) {
        list.push({ start: block.start_datetime, end: block.end_datetime });
      }
    }
  }

  const appointmentsByBarber = new Map(barberIds.map((id) => [id, []]));
  for (const appointment of appointmentRows) {
    const list = appointmentsByBarber.get(appointment.barber_id);
    if (list) {
      list.push({
        start: appointment.start_datetime,
        end: appointment.end_datetime
      });
    }
  }

  const dates = dateList(firstDate, lastDate);
  const referenceNow = now();

  const days = dates.map((date) => {
    const weekday = weekdayOf(date);
    const union = new Set();
    for (const barber of barbers) {
      const times = getAvailableStartTimes({
        date,
        serviceDuration: service.duration_minutes,
        intervalMinutes: rules.slotIntervalMinutes,
        businessHours: businessHours[weekday],
        workingHours: workingByBarberWeekday.get(`${barber.id}-${weekday}`) || null,
        blocks: blocksByBarber.get(barber.id) || [],
        appointments: appointmentsByBarber.get(barber.id) || [],
        now: referenceNow,
        minAdvanceMinutes: rules.minAdvanceMinutes,
        maxAdvanceDays: rules.maxAdvanceDays
      });
      times.forEach((time) => union.add(time));
    }
    return {
      date,
      available: union.size > 0,
      count: union.size
    };
  });

  return {
    month,
    service,
    barbers: barbers.map((barber) => ({
      id: barber.id,
      name: barber.name,
      photo_url: barber.photo_url,
      bio: barber.bio
    })),
    days,
    rules
  };
}

module.exports = {
  getService,
  getEligibleBarbers,
  getBarberForService,
  getWorkingHours,
  getBlocksForDay,
  getAppointmentsForDay,
  getAvailabilityForBarber,
  getAvailability,
  getAvailableDays
};
