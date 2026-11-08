const crypto = require('crypto');
const mysql = require('mysql2/promise');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const config = require('../src/config');
const { runSeedSql, printAndExit } = require('./lib/db');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = config.timezone;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(prefix) {
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return `${prefix}-${suffix}`;
}

function dbDate(value) {
  return value.format('YYYY-MM-DD HH:mm:ss');
}

async function uniqueCode(connection, prefix) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = makeCode(prefix);
    const [rows] = await connection.execute(
      'SELECT 1 FROM appointments WHERE code = ? LIMIT 1',
      [code]
    );
    if (rows.length === 0) return code;
  }
  throw new Error('No se pudo generar un código único para las citas de demostración.');
}

async function insertEvent(connection, appointmentId, type, description) {
  await connection.execute(
    'INSERT INTO appointment_events (appointment_id, event_type, description) VALUES (?, ?, ?)',
    [appointmentId, type, description]
  );
}

async function assertSeedAllowed(connection) {
  try {
    const [rows] = await connection.execute(
      'SELECT COUNT(*) AS total FROM appointments'
    );
    const total = Number(rows[0] && rows[0].total) || 0;
    if (total > 0 && process.env.ALLOW_DESTRUCTIVE_SEED !== '1') {
      throw new Error(
        `La base de datos ya tiene ${total} cita(s). El seed elimina todas las citas y bloqueos existentes. ` +
          'Si de verdad quieres borrarlos, ejecuta ALLOW_DESTRUCTIVE_SEED=1 npm run db:seed ' +
          'o usa npm run db:reset en un entorno de desarrollo.'
      );
    }
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return;
    throw error;
  }
}

async function seedDatabase() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    charset: 'utf8mb4',
    dateStrings: true,
    timezone: '-05:00'
  });

  try {
    await assertSeedAllowed(connection);
    await runSeedSql();

    const [prefixRows] = await connection.execute(
      "SELECT setting_value FROM settings WHERE setting_key = 'business_code_prefix' LIMIT 1"
    );
    const prefix = prefixRows.length > 0 ? prefixRows[0].setting_value : 'DF';
    const now = dayjs().tz(TZ).startOf('minute');
    const monday = now
      .startOf('day')
      .subtract((now.day() + 6) % 7, 'day');

    const demoAppointments = [
      {
        day: 0,
        time: '10:00',
        barberId: 1,
        serviceId: 1,
        status: 'confirmed',
        paymentMethod: 'cash_on_site',
        paymentStatus: 'pending',
        customerName: 'Carlos Ramírez',
        customerPhone: '3001112233',
        customerEmail: 'carlos.ramirez@example.com',
        notes: 'Prefiere máquina 1 a los lados.'
      },
      {
        day: 0,
        time: '11:00',
        barberId: 3,
        serviceId: 2,
        status: 'confirmed',
        paymentMethod: 'cash_on_site',
        paymentStatus: 'pending',
        customerName: 'Julián Torres',
        customerPhone: '3002223344',
        customerEmail: null,
        notes: null
      },
      {
        day: 1,
        time: '10:00',
        barberId: 2,
        serviceId: 2,
        status: 'completed',
        paymentMethod: 'bank_transfer',
        paymentStatus: 'paid',
        customerName: 'Mateo Gómez',
        customerPhone: '3003334455',
        customerEmail: 'mateo.gomez@example.com',
        notes: 'Barba corta, sin bigote.'
      },
      {
        day: 1,
        time: '12:00',
        barberId: 1,
        serviceId: 3,
        status: 'completed',
        paymentMethod: 'cash_on_site',
        paymentStatus: 'paid',
        customerName: 'Andrés Mejía',
        customerPhone: '3004445566',
        customerEmail: null,
        notes: null
      },
      {
        day: 2,
        time: '15:00',
        barberId: 3,
        serviceId: 4,
        status: 'no_show',
        paymentMethod: 'cash_on_site',
        paymentStatus: 'pending',
        customerName: 'Samuel Rojas',
        customerPhone: '3005556677',
        customerEmail: null,
        notes: 'Corte para niño de 7 años.'
      },
      {
        day: 2,
        time: '16:00',
        barberId: 2,
        serviceId: 6,
        status: 'confirmed',
        paymentMethod: 'bank_transfer',
        paymentStatus: 'paid',
        customerName: 'Felipe Vargas',
        customerPhone: '3006667788',
        customerEmail: 'felipe.vargas@example.com',
        notes: 'Cuero cabelludo sensible.'
      },
      {
        day: 3,
        time: '09:30',
        barberId: 1,
        serviceId: 1,
        status: 'cancelled',
        paymentMethod: 'cash_on_site',
        paymentStatus: 'pending',
        customerName: 'Diego Salazar',
        customerPhone: '3007778899',
        customerEmail: null,
        notes: null,
        cancelReason: 'Cancelada por el cliente.'
      },
      {
        day: 3,
        time: '11:00',
        barberId: 3,
        serviceId: 5,
        status: 'confirmed',
        paymentMethod: 'cash_on_site',
        paymentStatus: 'pending',
        customerName: 'Nicolás Peña',
        customerPhone: '3008889900',
        customerEmail: 'nicolas.pena@example.com',
        notes: null
      },
      {
        day: 4,
        time: '10:00',
        barberId: 2,
        serviceId: 2,
        status: 'confirmed',
        paymentMethod: 'cash_on_site',
        paymentStatus: 'pending',
        customerName: 'Sebastián Mora',
        customerPhone: '3009990011',
        customerEmail: null,
        notes: 'Diseño sencillo en un lado.'
      },
      {
        day: 4,
        time: '14:30',
        barberId: 1,
        serviceId: 1,
        status: 'confirmed',
        paymentMethod: 'cash_on_site',
        paymentStatus: 'paid',
        customerName: 'Óscar Cárdenas',
        customerPhone: '3011112233',
        customerEmail: 'oscar.cardenas@example.com',
        notes: null
      },
      {
        day: 5,
        time: '11:00',
        barberId: 1,
        serviceId: 2,
        status: 'confirmed',
        paymentMethod: 'bank_transfer',
        paymentStatus: 'paid',
        customerName: 'Daniel Herrera',
        customerPhone: '3012223344',
        customerEmail: 'daniel.herrera@example.com',
        notes: null
      },
      {
        day: 5,
        time: '12:00',
        barberId: 2,
        serviceId: 4,
        status: 'confirmed',
        paymentMethod: 'cash_on_site',
        paymentStatus: 'pending',
        customerName: 'Tomás Quintero',
        customerPhone: '3013334455',
        customerEmail: null,
        notes: 'Primera visita.'
      }
    ];

    const [serviceRows] = await connection.execute(
      'SELECT id, duration_minutes, price FROM services'
    );
    const servicesById = new Map(serviceRows.map((row) => [row.id, row]));

    let created = 0;

    for (const item of demoAppointments) {
      const service = servicesById.get(item.serviceId);
      if (!service) continue;

      const date = monday.add(item.day, 'day').format('YYYY-MM-DD');
      const start = dayjs.tz(`${date} ${item.time}`, TZ);
      const end = start.add(service.duration_minutes, 'minute');

      let status = item.status;
      if (start.isBefore(now) && status === 'confirmed') status = 'completed';
      if (!start.isBefore(now) && (status === 'completed' || status === 'no_show')) {
        status = 'confirmed';
      }

      const code = await uniqueCode(connection, prefix);
      const [result] = await connection.execute(
        `INSERT INTO appointments
          (code, barber_id, service_id, start_datetime, end_datetime, price_at_booking,
           customer_name, customer_phone, customer_email, notes, status, payment_method,
           payment_status, cancel_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          item.barberId,
          item.serviceId,
          dbDate(start),
          dbDate(end),
          service.price,
          item.customerName,
          item.customerPhone,
          item.customerEmail,
          item.notes,
          status,
          item.paymentMethod,
          item.paymentStatus,
          item.cancelReason || null
        ]
      );

      const appointmentId = result.insertId;
      for (let offset = 0; offset < service.duration_minutes; offset += 30) {
        await connection.execute(
          'INSERT INTO appointment_slots (barber_id, slot_start, appointment_id) VALUES (?, ?, ?)',
          [item.barberId, dbDate(start.add(offset, 'minute')), appointmentId]
        );
      }

      await insertEvent(
        connection,
        appointmentId,
        'created',
        'Cita creada desde los datos de demostración.'
      );

      if (status === 'cancelled') {
        await insertEvent(
          connection,
          appointmentId,
          'cancelled',
          item.cancelReason || 'Cita cancelada.'
        );
      } else if (status === 'completed') {
        await insertEvent(connection, appointmentId, 'status_changed', 'Cita completada.');
      } else if (status === 'no_show') {
        await insertEvent(connection, appointmentId, 'status_changed', 'Cliente no asistió.');
      }

      if (item.paymentStatus === 'paid') {
        await insertEvent(
          connection,
          appointmentId,
          'payment_status_changed',
          'Pago confirmado.'
        );
      }

      created += 1;
    }

    const barberBlockStart = monday.add(7, 'day').add(13, 'hour');
    const barberBlockEnd = barberBlockStart.add(1, 'hour');
    await connection.execute(
      `INSERT INTO blocks (barber_id, start_datetime, end_datetime, reason, created_by)
       VALUES (?, ?, ?, ?, NULL)`,
      [1, dbDate(barberBlockStart), dbDate(barberBlockEnd), 'Almuerzo extendido / trámite personal']
    );

    const businessBlockStart = monday.add(12, 'day').add(18, 'hour');
    const businessBlockEnd = businessBlockStart.add(1, 'hour');
    await connection.execute(
      `INSERT INTO blocks (barber_id, start_datetime, end_datetime, reason, created_by)
       VALUES (NULL, ?, ?, ?, NULL)`,
      [dbDate(businessBlockStart), dbDate(businessBlockEnd), 'Mantenimiento del local']
    );

    return { appointments: created, blocks: 2 };
  } finally {
    await connection.end();
  }
}

async function main() {
  try {
    const result = await seedDatabase();
    console.log(
      `✔ Datos de demostración cargados: ${result.appointments} citas y ${result.blocks} bloqueos.`
    );
    console.log('  Crea el usuario administrador con: npm run admin:create');
  } catch (error) {
    printAndExit(error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedDatabase };
