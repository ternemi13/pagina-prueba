const { skipIfNoDatabase, nextWeekday } = require('./helpers');

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAppointment,
  lookupAppointment,
  cancelAppointmentByClient,
  cancelAppointmentByAdmin,
  updateAppointmentStatus,
  markAppointmentPaid,
  updateAppointmentNotes,
  rescheduleAppointment,
  listAppointments,
  getAppointmentDetail
} = require('../src/services/booking');
const { getAvailabilityForBarber } = require('../src/services/availability-db');
const { createBlock } = require('../src/services/blocks');
const { all, closePool } = require('../src/db/pool');

const ADMIN = { id: null, role: 'admin' };
let phoneCounter = 1000;

function customer() {
  phoneCounter += 1;
  return {
    customerName: 'Cliente de prueba',
    customerPhone: `300${String(phoneCounter).padStart(7, '0')}`,
    paymentMethod: 'cash_on_site'
  };
}

async function slotsFor(appointmentId) {
  return all(
    'SELECT barber_id, slot_start FROM appointment_slots WHERE appointment_id = ? ORDER BY slot_start',
    [appointmentId]
  );
}

async function availability(serviceId, barberId, date) {
  const result = await getAvailabilityForBarber({ serviceId, barberId, date });
  return result.times;
}

test.after(async () => {
  await closePool();
});

test('crea una cita, ocupa sus slots y permite consultarla', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(3);
  const data = customer();
  const { appointment, public: publicAppointment } = await createAppointment({
    serviceId: 1,
    barberId: 1,
    date,
    time: '09:00',
    paymentMethod: data.paymentMethod,
    customerName: data.customerName,
    customerPhone: data.customerPhone
  });

  assert.equal(appointment.status, 'confirmed');
  assert.equal(Number(appointment.price_at_booking), 25000);
  assert.equal(appointment.start_datetime, `${date} 09:00:00`);

  const slots = await slotsFor(appointment.id);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].slot_start, `${date} 09:00:00`);

  const lookedUp = await lookupAppointment({
    code: appointment.code,
    phone: data.customerPhone
  });
  assert.equal(lookedUp.code, appointment.code);
  assert.equal(lookedUp.service_name, 'Corte clásico');
  assert.equal(publicAppointment.id, undefined);
  assert.equal(publicAppointment.barber_id, undefined);
});

test('un servicio de 60 minutos ocupa dos slots y bloquea el solapado', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(4);
  const data = customer();
  const { appointment } = await createAppointment({
    serviceId: 2,
    barberId: 2,
    date,
    time: '10:00',
    paymentMethod: data.paymentMethod,
    customerName: data.customerName,
    customerPhone: data.customerPhone
  });

  const slots = await slotsFor(appointment.id);
  assert.deepEqual(
    slots.map((slot) => slot.slot_start),
    [`${date} 10:00:00`, `${date} 10:30:00`]
  );

  const times = await availability(2, 2, date);
  assert.ok(!times.includes('10:00'));
  assert.ok(!times.includes('09:30'));
  assert.ok(times.includes('11:00'));
});

test('rechaza una segunda reserva en la misma hora y barbero', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(5);
  const first = customer();
  const second = customer();

  await createAppointment({
    serviceId: 1,
    barberId: 1,
    date,
    time: '11:00',
    paymentMethod: first.paymentMethod,
    customerName: first.customerName,
    customerPhone: first.customerPhone
  });

  await assert.rejects(
    createAppointment({
      serviceId: 1,
      barberId: 1,
      date,
      time: '11:00',
      paymentMethod: second.paymentMethod,
      customerName: second.customerName,
      customerPhone: second.customerPhone
    }),
    (error) => error.status === 409
  );
});

test('cancelar una cita libera la hora al instante', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(3);
  const data = customer();
  const { appointment } = await createAppointment({
    serviceId: 1,
    barberId: 3,
    date,
    time: '12:00',
    paymentMethod: data.paymentMethod,
    customerName: data.customerName,
    customerPhone: data.customerPhone
  });

  assert.ok(!(await availability(1, 3, date)).includes('12:00'));
  await cancelAppointmentByClient({
    code: appointment.code,
    phone: data.customerPhone,
    reason: 'Prueba de cancelación'
  });

  assert.ok((await availability(1, 3, date)).includes('12:00'));
  const slots = await slotsFor(appointment.id);
  assert.equal(slots.length, 0);
});

test('"cualquiera disponible" reparte entre barberos y evita solapamientos', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(2);
  const barberIds = [];

  for (let index = 0; index < 3; index += 1) {
    const data = customer();
    const { appointment } = await createAppointment({
      serviceId: 1,
      barberId: 'any',
      date,
      time: '15:00',
      paymentMethod: data.paymentMethod,
      customerName: data.customerName,
      customerPhone: data.customerPhone
    });
    barberIds.push(Number(appointment.barber_id));
  }

  assert.equal(new Set(barberIds).size, 3);

  const extra = customer();
  await assert.rejects(
    createAppointment({
      serviceId: 1,
      barberId: 'any',
      date,
      time: '15:00',
      paymentMethod: extra.paymentMethod,
      customerName: extra.customerName,
      customerPhone: extra.customerPhone
    }),
    (error) => error.status === 409
  );
});

test('un bloqueo quita horas de la disponibilidad', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(1);
  await createBlock({
    barberId: 1,
    start: `${date} 10:00:00`,
    end: `${date} 11:30:00`,
    reason: 'Prueba de bloqueo',
    createdBy: null
  });

  const times = await availability(1, 1, date);
  assert.ok(!times.includes('10:00'));
  assert.ok(!times.includes('10:30'));
  assert.ok(!times.includes('11:00'));
  assert.ok(times.includes('11:30'));
});

test('un bloqueo avisa de las citas afectadas y exige confirmación', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(1);
  const data = customer();
  const { appointment } = await createAppointment({
    serviceId: 1,
    barberId: 1,
    date,
    time: '14:00',
    paymentMethod: data.paymentMethod,
    customerName: data.customerName,
    customerPhone: data.customerPhone
  });

  await assert.rejects(
    createBlock({
      barberId: 1,
      start: `${date} 14:00:00`,
      end: `${date} 15:00:00`,
      reason: 'Bloqueo con cita',
      createdBy: null
    }),
    (error) =>
      error.status === 409 &&
      error.details.affected.some((item) => Number(item.id) === Number(appointment.id))
  );

  const result = await createBlock({
    barberId: 1,
    start: `${date} 14:00:00`,
    end: `${date} 15:00:00`,
    reason: 'Bloqueo con cita',
    createdBy: null,
    cancelAffected: true
  });
  assert.equal(result.cancelledAppointments, 1);
  assert.equal((await slotsFor(appointment.id)).length, 0);
});

test('reprogramar mueve los slots y libera el horario anterior', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(4);
  const data = customer();
  const { appointment } = await createAppointment({
    serviceId: 1,
    barberId: 1,
    date,
    time: '15:00',
    paymentMethod: data.paymentMethod,
    customerName: data.customerName,
    customerPhone: data.customerPhone
  });

  await rescheduleAppointment({
    id: appointment.id,
    date,
    time: '16:00',
    barberId: 1,
    user: ADMIN
  });

  const slots = await slotsFor(appointment.id);
  assert.deepEqual(
    slots.map((slot) => slot.slot_start),
    [`${date} 16:00:00`]
  );

  const times = await availability(1, 1, date);
  assert.ok(times.includes('15:00'));
  assert.ok(!times.includes('16:00'));
});

test('un barbero solo ve y gestiona sus propias citas', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(3);
  const data = customer();
  const { appointment } = await createAppointment({
    serviceId: 1,
    barberId: 1,
    date,
    time: '16:00',
    paymentMethod: data.paymentMethod,
    customerName: data.customerName,
    customerPhone: data.customerPhone
  });

  const owner = { id: null, role: 'barber', barber_id: 1 };
  const otherBarber = { id: null, role: 'barber', barber_id: 2 };

  const ownDetail = await getAppointmentDetail({ id: appointment.id, user: owner });
  assert.equal(Number(ownDetail.appointment.id), Number(appointment.id));

  await assert.rejects(
    getAppointmentDetail({ id: appointment.id, user: otherBarber }),
    (error) => error.status === 404
  );
  await assert.rejects(
    updateAppointmentNotes({ id: appointment.id, notes: 'No permitido', user: otherBarber }),
    (error) => error.status === 404
  );

  const otherList = await listAppointments({}, otherBarber);
  assert.ok(!otherList.some((item) => Number(item.id) === Number(appointment.id)));

  const adminList = await listAppointments(
    { search: appointment.code },
    { id: null, role: 'admin' }
  );
  assert.ok(adminList.some((item) => Number(item.id) === Number(appointment.id)));
});

test('permite completar, marcar pagada y editar notas con historial', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(4);
  const data = customer();
  const { appointment } = await createAppointment({
    serviceId: 1,
    barberId: 1,
    date,
    time: '17:00',
    paymentMethod: data.paymentMethod,
    customerName: data.customerName,
    customerPhone: data.customerPhone
  });

  const completed = await updateAppointmentStatus({
    id: appointment.id,
    status: 'completed',
    user: ADMIN
  });
  assert.equal(completed.status, 'completed');

  const paid = await markAppointmentPaid({ id: appointment.id, user: ADMIN });
  assert.equal(paid.payment_status, 'paid');

  const withNotes = await updateAppointmentNotes({
    id: appointment.id,
    notes: 'Cliente frecuente',
    user: ADMIN
  });
  assert.equal(withNotes.notes, 'Cliente frecuente');

  const detail = await getAppointmentDetail({ id: appointment.id, user: ADMIN });
  assert.ok(detail.events.length >= 4);
});

test('el administrador puede cancelar una cita existente', async (t) => {
  if (await skipIfNoDatabase(t)) return;

  const date = nextWeekday(2);
  const data = customer();
  const { appointment } = await createAppointment({
    serviceId: 1,
    barberId: 3,
    date,
    time: '09:30',
    paymentMethod: data.paymentMethod,
    customerName: data.customerName,
    customerPhone: data.customerPhone
  });

  const cancelled = await cancelAppointmentByAdmin({
    id: appointment.id,
    reason: 'Cancelada desde el panel',
    user: ADMIN
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal((await slotsFor(appointment.id)).length, 0);
});
