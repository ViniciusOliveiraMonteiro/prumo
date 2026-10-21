import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http/configure-http.js';

config({ path: '../.env', quiet: true });
const connectionString = process.env.PRUMO_DATABASE_URL;
const appConnectionString = process.env.PRUMO_APP_DATABASE_URL;
if (!connectionString || !appConnectionString)
  throw new Error('PRUMO_DATABASE_URL and PRUMO_APP_DATABASE_URL are required');
const admin = new pg.Pool({ connectionString });
const restricted = new pg.Pool({ connectionString: appConnectionString });
const users: { id: string; email: string; cookie: string }[] = [];
const householdIds: string[] = [];
let app: INestApplication<App>;
let a: string;
let b: string;

function revoke(id: string, target: string, actor = 0) {
  return request(app.getHttpServer())
    .post(`/api/households/${id}/memberships/${target}/revoke`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[actor].cookie);
}

function list(id: string, actor = 0) {
  return request(app.getHttpServer())
    .get(`/api/households/${id}/memberships`)
    .set('Cookie', users[actor].cookie);
}

function rename(id: string) {
  return request(app.getHttpServer())
    .patch(`/api/households/${id}`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[0].cookie)
    .send({ name: 'Concurrent rename' });
}

async function createHousehold(actor: number): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/households')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[actor].cookie)
    .send({ name: 'Membership test' })
    .expect(201);
  const id = response.body.id as string;
  householdIds.push(id);
  return id;
}

async function waitForBlocked(inspector: pg.PoolClient, pid: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await inspector.query<{ pid: number }>(
      'SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))',
      [pid],
    );
    if (result.rows[0]) return result.rows[0].pid;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Expected an API transaction to wait for the held row lock');
}

async function membershipState(target: number) {
  const result = await admin.query<{ active: boolean }>(
    'SELECT active FROM household.memberships WHERE household_id = $1 AND user_id = $2',
    [a, users[target].id],
  );
  return result.rows[0].active;
}

beforeAll(async () => {
  const password = 'membership-fixture-password';
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  for (let index = 0; index < 5; index++) {
    const email = `membership-${randomUUID()}@prumo.test`;
    const result = await admin.query<{ id: string }>(
      'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1, $1, $2) RETURNING id',
      [email, hash],
    );
    users.push({ id: result.rows[0].id, email, cookie: '' });
  }
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.init();
  for (const user of users) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .set('Host', 'localhost:3000')
      .set('Origin', 'http://localhost:3000')
      .send({ email: user.email, password })
      .expect(200);
    const cookies = response.headers['set-cookie'];
    user.cookie = Array.isArray(cookies) ? cookies[0] : cookies;
  }
});

beforeEach(async () => {
  a = await createHousehold(0);
  b = await createHousehold(1);
  await admin.query(
    `INSERT INTO household.memberships(household_id, user_id, role)
     VALUES ($1, $2, 'MEMBER'), ($1, $3, 'VIEWER'), ($1, $4, 'OWNER')`,
    [a, users[2].id, users[3].id, users[4].id],
  );
});

afterAll(async () => {
  await app?.close();
  for (const id of householdIds) {
    await admin.query('DELETE FROM household.events WHERE household_id = $1', [
      id,
    ]);
    await admin.query(
      'DELETE FROM household.memberships WHERE household_id = $1',
      [id],
    );
    await admin.query('DELETE FROM household.households WHERE id = $1', [id]);
  }
  for (const user of users)
    await admin.query('DELETE FROM identity.users WHERE id = $1', [user.id]);
  await admin.end();
  await restricted.end();
});

test('only active owners list userId and role; unauthorized requests disclose no household', async () => {
  const response = await list(a).expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toEqual(
    [0, 2, 3, 4]
      .map((index) => ({
        userId: users[index].id,
        role: index === 2 ? 'MEMBER' : index === 3 ? 'VIEWER' : 'OWNER',
      }))
      .sort((left, right) => left.userId.localeCompare(right.userId)),
  );
  for (const actor of [2, 3]) {
    await list(a, actor).expect(403);
    await revoke(a, users[3].id, actor).expect(403);
  }
  const inaccessible = await list(b).expect(404);
  const absent = await list(randomUUID()).expect(404);
  expect(inaccessible.body).toEqual(absent.body);
  expect(inaccessible.headers['cache-control']).toBe('no-store');
  await revoke(b, users[1].id).expect(404);
  await revoke(a, users[1].id).expect(404);
  await revoke(a, randomUUID()).expect(404);
  await list('invalid').expect(400);
  await revoke(a, 'invalid').expect(400);
  await request(app.getHttpServer())
    .get(`/api/households/${a}/memberships`)
    .expect(401);
  await request(app.getHttpServer())
    .post(`/api/households/${a}/memberships/${users[2].id}/revoke`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .expect(401);
  await request(app.getHttpServer())
    .post(`/api/households/${a}/memberships/${users[2].id}/revoke`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'https://foreign.test')
    .set('Cookie', users[0].cookie)
    .expect(403);
  expect(await membershipState(2)).toBe(true);
});

test('owners are protected and concurrent repeated revocations produce one audit event per target', async () => {
  await revoke(a, users[0].id).expect(409);
  await revoke(a, users[4].id).expect(409);
  for (const index of [2, 3]) {
    const responses = await Promise.all([
      revoke(a.toUpperCase(), users[index].id.toUpperCase()),
      revoke(a, users[index].id),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([204, 204]);
    expect(responses.every(({ text }) => text === '')).toBe(true);
    expect(
      responses.every(({ headers }) => headers['cache-control'] === 'no-store'),
    ).toBe(true);
    expect(await membershipState(index)).toBe(false);
    await revoke(a, users[index].id).expect(204);
  }
  const events = await admin.query(
    `SELECT actor_user_id, target_user_id, previous_role FROM household.events
     WHERE household_id = $1 AND kind = 'membership_revoked' ORDER BY previous_role`,
    [a],
  );
  expect(events.rows).toEqual([
    {
      actor_user_id: users[0].id,
      target_user_id: users[2].id,
      previous_role: 'MEMBER',
    },
    {
      actor_user_id: users[0].id,
      target_user_id: users[3].id,
      previous_role: 'VIEWER',
    },
  ]);
  const remaining = await list(a).expect(200);
  expect(
    remaining.body.map((row: { userId: string }) => row.userId).sort(),
  ).toEqual([users[0].id, users[4].id].sort());
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', users[2].cookie)
    .expect(200);
  await request(app.getHttpServer())
    .get(`/api/households/${a}`)
    .set('Cookie', users[2].cookie)
    .expect(404);
  await list(a, 2).expect(404);
  await revoke(a, users[3].id, 2).expect(404);
  expect(await membershipState(0)).toBe(true);
  expect(await membershipState(4)).toBe(true);
});

test('failure to audit rolls back membership deactivation', async () => {
  const trigger = `test_membership_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`
    CREATE FUNCTION household.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected membership audit failure'; END; $$
  `);
  try {
    await admin.query(`
      CREATE TRIGGER ${trigger} BEFORE INSERT ON household.events
      FOR EACH ROW WHEN (NEW.household_id = '${a}'::uuid AND NEW.kind = 'membership_revoked')
      EXECUTE FUNCTION household.${trigger}()
    `);
    await revoke(a, users[2].id).expect(500);
    expect(await membershipState(2)).toBe(true);
    const events = await admin.query(
      "SELECT id FROM household.events WHERE household_id = $1 AND kind = 'membership_revoked'",
      [a],
    );
    expect(events.rows).toHaveLength(0);
  } finally {
    await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON household.events`);
    await admin.query(`DROP FUNCTION household.${trigger}()`);
  }
  await revoke(a, users[2].id).expect(204);
});

test('revocation waits for an existing synthetic protected operation under prumo_app', async () => {
  const holder = await restricted.connect();
  const inspector = await admin.connect();
  let pending: Promise<request.Response> | undefined;
  try {
    await holder.query('BEGIN');
    const pid = await holder.query<{ pid: number }>(
      'SELECT pg_backend_pid() AS pid',
    );
    const membership = await holder.query(
      'SELECT role FROM household.memberships WHERE household_id = $1 AND user_id = $2 AND active FOR SHARE',
      [a, users[2].id],
    );
    expect(membership.rows).toHaveLength(1);
    pending = revoke(a, users[2].id).then((response) => response);
    await waitForBlocked(inspector, pid.rows[0].pid);
    expect(await membershipState(2)).toBe(true);
    await holder.query('COMMIT');
    expect((await pending).status).toBe(204);
    expect(await membershipState(2)).toBe(false);
  } finally {
    await holder.query('ROLLBACK');
    await pending;
    holder.release();
    inspector.release();
  }
});

test('synthetic protected operation waiting behind API revocation sees no active membership', async () => {
  const holder = await admin.connect();
  const inspector = await admin.connect();
  const reader = await restricted.connect();
  let revoking: Promise<request.Response> | undefined;
  let reading: Promise<pg.QueryResult> | undefined;
  try {
    await holder.query('BEGIN');
    const pid = await holder.query<{ pid: number }>(
      'SELECT pg_backend_pid() AS pid',
    );
    // Hold the event insertion after the API has locked and deactivated its target.
    await holder.query('LOCK TABLE household.events IN SHARE MODE');
    revoking = revoke(a, users[2].id).then((response) => response);
    const revokerPid = await waitForBlocked(inspector, pid.rows[0].pid);
    await reader.query('BEGIN');
    reading = reader.query(
      'SELECT role FROM household.memberships WHERE household_id = $1 AND user_id = $2 AND active FOR SHARE',
      [a, users[2].id],
    );
    await waitForBlocked(inspector, revokerPid);
    await holder.query('COMMIT');
    expect((await revoking).status).toBe(204);
    expect((await reading).rows).toHaveLength(0);
    await reader.query('COMMIT');
  } finally {
    await holder.query('ROLLBACK');
    await revoking;
    await reading;
    await reader.query('ROLLBACK');
    holder.release();
    inspector.release();
    reader.release();
  }
});

test('rename and API revocation finish without deadlock while rename holds the owner membership', async () => {
  const holder = await admin.connect();
  const inspector = await admin.connect();
  let writing: Promise<request.Response> | undefined;
  let revoking: Promise<request.Response> | undefined;
  try {
    await holder.query('BEGIN');
    const pid = await holder.query<{ pid: number }>(
      'SELECT pg_backend_pid() AS pid',
    );
    await holder.query(
      'SELECT id FROM household.households WHERE id = $1 FOR UPDATE',
      [a],
    );
    writing = rename(a).then((response) => response);
    const writerPid = await waitForBlocked(inspector, pid.rows[0].pid);
    revoking = revoke(a, users[2].id).then((response) => response);
    await waitForBlocked(inspector, writerPid);
    await holder.query('COMMIT');
    expect((await writing).status).toBe(200);
    expect((await revoking).status).toBe(204);
    expect(await membershipState(2)).toBe(false);
  } finally {
    await holder.query('ROLLBACK');
    await writing;
    await revoking;
    holder.release();
    inspector.release();
  }
});
