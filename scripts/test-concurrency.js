process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'barberia_test';

const { resetDatabase, friendlyDbError } = require('./lib/db');
const { seedDatabase } = require('./seed');
const { dayjs, TZ } = require('../src/utils/datetime');

const TOTAL_REQUESTS = 30;
const SERVICE_ID = 1;

function nextWeekday(weekday, minDaysAhead = 7) {
  let date = dayjs().tz(TZ).startOf('day').add(minDaysAhead, 'day');
  while (date.day() !== weekday) {
    date = date.add(1, 'day');
  }
  return date.format('YYYY-MM-DD');
}

function cookiesFrom(response) {
  const header = response.headers;
  const list =
    typeof header.getSetCookie === 'function'
      ? header.getSetCookie()
      : [header.get('set-cookie')];
  return list
    .filter(Boolean)
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function createSession(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`No se pudo obtener el token CSRF (HTTP ${response.status}).`);
  }
  const data = await response.json();
  return { token: data.csrfToken, cookie: cookiesFrom(response) };
}

async function book(baseUrl, session, body) {
  const response = await fetch(`${baseUrl}/api/public/appointments`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-csrf-token': session.token,
      Cookie: session.cookie
    },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    data: await response.json().catch(() => ({}))
  };
}

function buildBody({ date, time, barberId, index }) {
  return {
    service_id: SERVICE_ID,
    barber_id: barberId,
    date,
    time,
    customer_name: `Cliente concurrencia ${index}`,
    customer_phone: `300${String(1000000 + index).slice(-7)}`,
    customer_email: '',
    notes: '',
    payment_method: 'cash_on_site'
  };
}

async function runBatch(baseUrl, session, jobs) {
  return Promise.all(jobs.map((job) => book(baseUrl, session, job)));
}

function summarize(results) {
  const byStatus = new Map();
  for (const result of results) {
    byStatus.set(result.status, (byStatus.get(result.status) || 0) + 1);
  }
  return byStatus;
}

function report(title, results, expectedSuccess, expectedConflicts) {
  const byStatus = summarize(results);
  const created = byStatus.get(201) || 0;
  const conflicts = byStatus.get(409) || 0;
  const unexpected = [...byStatus.entries()].filter(
    ([status]) => status !== 201 && status !== 409
  );

  const ok = created === expectedSuccess && conflicts === expectedConflicts;
  console.log(`\n${title}`);
  console.log(`  creadas:    ${created} (esperado ${expectedSuccess})`);
  console.log(`  rechazadas: ${conflicts} (esperado ${expectedConflicts})`);
  if (unexpected.length > 0) {
    console.log(`  estados inesperados: ${unexpected.map(([s, n]) => `${s} x${n}`).join(', ')}`);
  }
  console.log(`  ${ok ? 'OK' : 'FALLÓ'}`);

  if (!ok && unexpected.length > 0) {
    const sample = results.find(
      (result) => result.status !== 201 && result.status !== 409
    );
    if (sample) {
      console.log(`  ejemplo: ${JSON.stringify(sample.data)}`);
    }
  }

  return ok;
}

async function main() {
  let server;
  let closeResources = async () => {};

  try {
    console.log('Preparando base de datos de prueba...');
    await resetDatabase();
    await seedDatabase();

    const app = require('../src/app');
    const { sessionStore } = require('../src/middleware/session');
    const { closePool } = require('../src/db/pool');

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    closeResources = async () => {
      await new Promise((resolve) => server.close(resolve));
      await new Promise((resolve) => sessionStore.close(resolve));
      await closePool();
    };

    const session = await createSession(baseUrl);
    const wednesday = nextWeekday(3);
    const tuesday = nextWeekday(2);
    const thursday = nextWeekday(4);

    let ok = true;

    const sameSlot = await runBatch(
      baseUrl,
      session,
      Array.from({ length: TOTAL_REQUESTS }, (_, index) =>
        buildBody({ date: wednesday, time: '09:00', barberId: 1, index })
      )
    );
    ok =
      report(
        'Misma hora y mismo barbero (30 solicitudes)',
        sameSlot,
        1,
        TOTAL_REQUESTS - 1
      ) && ok;

    const anyBarber = await runBatch(
      baseUrl,
      session,
      Array.from({ length: TOTAL_REQUESTS }, (_, index) =>
        buildBody({ date: tuesday, time: '15:00', barberId: 'any', index })
      )
    );
    ok =
      report(
        'Misma hora con "cualquiera disponible" (30 solicitudes)',
        anyBarber,
        3,
        TOTAL_REQUESTS - 3
      ) && ok;

    const differentBarbers = await runBatch(
      baseUrl,
      session,
      Array.from({ length: TOTAL_REQUESTS }, (_, index) =>
        buildBody({
          date: thursday,
          time: '16:00',
          barberId: (index % 3) + 1,
          index
        })
      )
    );
    ok = report(
      'Misma hora con tres barberos distintos (30 solicitudes)',
      differentBarbers,
      3,
      TOTAL_REQUESTS - 3
    ) && ok;

    console.log(
      ok
        ? '\nResultado final: la protección contra doble reserva funciona.\n'
        : '\nResultado final: hay fallos en la protección contra doble reserva.\n'
    );
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    console.error(`\n✖ ${friendlyDbError(error)}\n`);
    process.exitCode = 1;
  } finally {
    await closeResources().catch(() => {});
  }
}

main();
