require('./helpers');

const test = require('node:test');
const assert = require('node:assert/strict');
const { dayjs, TZ } = require('../src/utils/datetime');
const {
  getAvailableStartTimes,
  getAvailableDays,
  isStartTimeAvailable
} = require('../src/services/availability');

const DATE = '2026-11-04';
const NOW = dayjs.tz('2026-11-04T08:00:00', TZ);

const businessHours = { closed: false, start: '09:00', end: '19:00' };
const workingHours = {
  start: '09:00',
  end: '19:00',
  break_start: null,
  break_end: null
};

function params(overrides = {}) {
  return {
    date: DATE,
    serviceDuration: 30,
    intervalMinutes: 30,
    businessHours,
    workingHours,
    now: NOW,
    minAdvanceMinutes: 0,
    maxAdvanceDays: 30,
    ...overrides
  };
}

test('genera slots de 30 minutos hasta el cierre', () => {
  const times = getAvailableStartTimes(params());
  assert.equal(times.length, 20);
  assert.equal(times[0], '09:00');
  assert.equal(times.at(-1), '18:30');
});

test('un servicio de 60 minutos solo se ofrece si caben dos slots', () => {
  const times = getAvailableStartTimes(params({ serviceDuration: 60 }));
  assert.equal(times.at(-1), '18:00');
  assert.ok(!times.includes('18:30'));
});

test('respeta la pausa de almuerzo', () => {
  const times = getAvailableStartTimes(
    params({
      workingHours: {
        start: '09:00',
        end: '19:00',
        break_start: '13:00',
        break_end: '14:00'
      }
    })
  );
  assert.ok(!times.includes('13:00'));
  assert.ok(!times.includes('13:30'));
  assert.ok(times.includes('12:30'));
  assert.ok(times.includes('14:00'));
});

test('un servicio largo no se cruza con la pausa', () => {
  const times = getAvailableStartTimes(
    params({
      serviceDuration: 60,
      workingHours: {
        start: '09:00',
        end: '19:00',
        break_start: '13:00',
        break_end: '14:00'
      }
    })
  );
  assert.ok(times.includes('12:00'));
  assert.ok(!times.includes('12:30'));
  assert.ok(!times.includes('13:00'));
  assert.ok(times.includes('14:00'));
});

test('los bloqueos quitan las horas que se cruzan', () => {
  const times = getAvailableStartTimes(
    params({
      blocks: [{ start: '2026-11-04 10:00:00', end: '2026-11-04 11:00:00' }]
    })
  );
  assert.ok(!times.includes('10:00'));
  assert.ok(!times.includes('10:30'));
  assert.ok(times.includes('09:30'));
  assert.ok(times.includes('11:00'));
});

test('las citas existentes quitan las horas ocupadas', () => {
  const times = getAvailableStartTimes(
    params({
      appointments: [{ start: '2026-11-04 15:00:00', end: '2026-11-04 16:00:00' }]
    })
  );
  assert.ok(times.includes('14:30'));
  assert.ok(!times.includes('15:00'));
  assert.ok(!times.includes('15:30'));
  assert.ok(times.includes('16:00'));
});

test('respeta la anticipación mínima del día actual', () => {
  const times = getAvailableStartTimes(
    params({
      date: '2026-11-04',
      now: dayjs.tz('2026-11-04T08:00:00', TZ),
      minAdvanceMinutes: 60,
      businessHours: { closed: false, start: '08:00', end: '19:00' },
      workingHours: {
        start: '08:00',
        end: '19:00',
        break_start: null,
        break_end: null
      }
    })
  );
  assert.ok(!times.includes('08:00'));
  assert.ok(!times.includes('08:30'));
  assert.ok(times.includes('09:00'));
});

test('no ofrece horas que ya pasaron hoy', () => {
  const times = getAvailableStartTimes(
    params({
      now: dayjs.tz('2026-11-04T15:10:00', TZ),
      minAdvanceMinutes: 0
    })
  );
  assert.ok(!times.includes('15:00'));
  assert.ok(times.includes('15:30'));
});

test('no ofrece fechas pasadas ni fuera del rango máximo', () => {
  assert.deepEqual(
    getAvailableStartTimes(params({ date: '2026-11-03' })),
    []
  );
  assert.deepEqual(
    getAvailableStartTimes(params({ date: '2026-12-05' })),
    []
  );
  assert.ok(getAvailableStartTimes(params({ date: '2026-12-04' })).length > 0);
});

test('devuelve vacío si el negocio está cerrado o el barbero no trabaja', () => {
  assert.deepEqual(
    getAvailableStartTimes(
      params({ businessHours: { closed: true, start: '09:00', end: '19:00' } })
    ),
    []
  );
  assert.deepEqual(getAvailableStartTimes(params({ workingHours: null })), []);
});

test('rechaza duraciones que no son múltiplo del intervalo', () => {
  assert.deepEqual(getAvailableStartTimes(params({ serviceDuration: 45 })), []);
});

test('cruza el horario del negocio con el del barbero', () => {
  const times = getAvailableStartTimes(
    params({
      businessHours: { closed: false, start: '09:00', end: '19:00' },
      workingHours: {
        start: '10:00',
        end: '17:00',
        break_start: null,
        break_end: null
      }
    })
  );
  assert.equal(times[0], '10:00');
  assert.equal(times.at(-1), '16:30');
});

test('isStartTimeAvailable valida una hora concreta', () => {
  assert.equal(isStartTimeAvailable({ ...params(), time: '09:00' }), true);
  assert.equal(isStartTimeAvailable({ ...params(), time: '08:30' }), false);
});

test('getAvailableDays marca los días sin disponibilidad', () => {
  const days = getAvailableDays({
    dates: ['2026-11-04', '2026-11-08'],
    serviceDuration: 30,
    intervalMinutes: 30,
    businessHoursByWeekday: {
      0: { weekday: 0, closed: true, start: '09:00', end: '19:00' },
      3: { weekday: 3, closed: false, start: '09:00', end: '19:00' }
    },
    workingHoursByWeekday: {
      0: null,
      3: workingHours
    },
    blocksByDate: {},
    appointmentsByDate: {},
    now: NOW,
    minAdvanceMinutes: 0,
    maxAdvanceDays: 30
  });
  assert.deepEqual(days[0].available, true);
  assert.deepEqual(days[1].available, false);
  assert.equal(days[1].count, 0);
});
