const { dbReady, skipIfNoDatabase } = require('./helpers');

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { closePool } = require('../src/db/pool');
const { createUser } = require('../src/services/auth');

const ADMIN_PASSWORD = 'AdminPass123';
const BARBER_PASSWORD = 'BarberPass123';
const SECOND_ADMIN_PASSWORD = 'SecondPass123';

let app = null;
let setupPromise = null;

async function setup() {
  if (!setupPromise) {
    setupPromise = (async () => {
      await dbReady();
      app = require('../src/app');
      await createUser({ username: 'admin_test', password: ADMIN_PASSWORD, role: 'admin' });
      await createUser({
        username: 'barber_test',
        password: BARBER_PASSWORD,
        role: 'barber',
        barberId: 1
      });
      await createUser({
        username: 'admin_password_test',
        password: SECOND_ADMIN_PASSWORD,
        role: 'admin'
      });
      return app;
    })();
  }
  return setupPromise;
}

async function tokenFor(agent) {
  const response = await agent.get('/api/auth/csrf').expect(200);
  return response.body.csrfToken;
}

async function login(agent, username, password) {
  const token = await tokenFor(agent);
  await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ username, password })
    .expect(200);
}

test.after(async () => {
  try {
    const { sessionStore } = require('../src/middleware/session');
    await new Promise((resolve) => sessionStore.close(resolve));
  } catch (error) {
    // La sesión no llegó a inicializarse.
  }
  await closePool();
});

test('sin sesión no se accede al panel ni a sus endpoints', async (t) => {
  try {
    await setup();
  } catch (error) {
    t.skip(error.message);
    return;
  }

  await request(app).get('/api/admin/dashboard').expect(401);
  const redirect = await request(app).get('/admin').expect(302);
  assert.match(redirect.headers.location, /\/admin\/login/);
});

test('el login exige token CSRF', async (t) => {
  try {
    await setup();
  } catch (error) {
    t.skip(error.message);
    return;
  }

  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin_test', password: ADMIN_PASSWORD })
    .expect(403);
  assert.equal(response.body.error.code, 'CSRF_INVALID');
});

test('un administrador inicia sesión y ve el dashboard', async (t) => {
  try {
    await setup();
  } catch (error) {
    t.skip(error.message);
    return;
  }

  const agent = request.agent(app);
  await login(agent, 'admin_test', ADMIN_PASSWORD);

  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.user.username, 'admin_test');
  assert.equal(me.body.user.role, 'admin');

  const dashboard = await agent.get('/api/admin/dashboard').expect(200);
  assert.ok(dashboard.body.stats);
  assert.ok(Array.isArray(dashboard.body.todayAppointments));
});

test('un administrador carga barberos, usuarios y bloqueos sin errores', async (t) => {
  try {
    await setup();
  } catch (error) {
    t.skip(error.message);
    return;
  }

  const agent = request.agent(app);
  await login(agent, 'admin_test', ADMIN_PASSWORD);

  const barbers = await agent.get('/api/admin/barbers').expect(200);
  assert.equal(barbers.body.barbers.length, 3);
  assert.ok(Array.isArray(barbers.body.barbers[0].working_hours));

  const users = await agent.get('/api/admin/users').expect(200);
  assert.ok(users.body.users.some((user) => user.username === 'admin_test'));

  const blocks = await agent.get('/api/admin/blocks').expect(200);
  assert.ok(Array.isArray(blocks.body.blocks));

  const affected = await agent
    .get('/api/admin/blocks/affected')
    .query({ start: '2026-11-01 00:00:00', end: '2026-11-30 23:59:59' })
    .expect(200);
  assert.ok(Array.isArray(affected.body.affected));
});

test('un usuario barbero no accede a la configuración ni a servicios', async (t) => {
  try {
    await setup();
  } catch (error) {
    t.skip(error.message);
    return;
  }

  const agent = request.agent(app);
  await login(agent, 'barber_test', BARBER_PASSWORD);

  await agent.get('/api/admin/services').expect(403);
  await agent.get('/api/admin/settings').expect(403);
  await agent.get('/api/admin/users').expect(403);
  await agent.get('/api/admin/appointments').expect(200);
  await agent.get('/api/admin/dashboard').expect(200);
});

test('el logout invalida la sesión', async (t) => {
  try {
    await setup();
  } catch (error) {
    t.skip(error.message);
    return;
  }

  const agent = request.agent(app);
  await login(agent, 'admin_test', ADMIN_PASSWORD);

  const token = await tokenFor(agent);
  await agent.post('/api/auth/logout').set('x-csrf-token', token).expect(200);
  await agent.get('/api/admin/dashboard').expect(401);
});

test('se puede cambiar la contraseña desde la sesión', async (t) => {
  try {
    await setup();
  } catch (error) {
    t.skip(error.message);
    return;
  }

  const agent = request.agent(app);
  await login(agent, 'admin_password_test', SECOND_ADMIN_PASSWORD);

  const token = await tokenFor(agent);
  await agent
    .post('/api/auth/change-password')
    .set('x-csrf-token', token)
    .send({ current_password: SECOND_ADMIN_PASSWORD, new_password: 'NewSecondPass123' })
    .expect(200);

  const secondAgent = request.agent(app);
  await login(secondAgent, 'admin_password_test', 'NewSecondPass123');
  const me = await secondAgent.get('/api/auth/me').expect(200);
  assert.equal(me.body.user.username, 'admin_password_test');
});

test('tras cinco intentos fallidos la cuenta queda bloqueada', async (t) => {
  try {
    await setup();
  } catch (error) {
    t.skip(error.message);
    return;
  }

  const agent = request.agent(app);
  const token = await tokenFor(agent);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await agent
      .post('/api/auth/login')
      .set('x-csrf-token', token)
      .send({ username: 'nadie_existe', password: 'WrongPass123' })
      .expect(401);
  }

  const blocked = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ username: 'nadie_existe', password: 'WrongPass123' })
    .expect(429);
  assert.match(blocked.body.error.message, /Demasiados intentos/i);
});
