import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import pg from 'pg';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http/configure-http.js';
import { HouseholdService } from '../src/household/household.service.js';

config({ path: '../.env', quiet: true });
const connectionString = process.env.PRUMO_DATABASE_URL;
const appConnectionString = process.env.PRUMO_APP_DATABASE_URL;
if (!connectionString || !appConnectionString)
  throw new Error('PRUMO_DATABASE_URL and PRUMO_APP_DATABASE_URL are required');
const admin = new pg.Pool({ connectionString });
const restricted = new pg.Pool({ connectionString: appConnectionString });
const password = 'household-test-password-long-enough';
const users: { id: string; email: string; cookie?: string }[] = [];
const householdIds: string[] = [];
let app: INestApplication<App>;

async function signIn(user: (typeof users)[number]): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email: user.email, password })
    .expect(200);
  const value = response.headers['set-cookie'];
  return Array.isArray(value) ? value[0] : value;
}

function patch(id: string, cookie: string, name: string) {
  return request(app.getHttpServer())
    .patch(`/api/households/${id}`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .send({ name });
}

async function waitForTransactionWait(
  inspector: pg.PoolClient,
  transactionId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const result = await inspector.query<{ waiting: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM pg_locks
        WHERE locktype = 'transactionid'
          AND transactionid::text = $1
          AND NOT granted
      ) AS waiting`,
      [transactionId],
    );
    if (result.rows[0].waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('The API did not wait on the membership transaction');
}

beforeAll(async () => {
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  for (let i = 0; i < 2; i++) {
    const email = `household-${randomUUID()}@prumo.test`;
    const result = await admin.query<{ id: string }>(
      'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [email, email, hash],
    );
    users.push({ id: result.rows[0].id, email });
  }
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.init();
  for (const user of users) user.cookie = await signIn(user);
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

test('application role has the row-lock privilege but cannot delete membership or read audit events', async () => {
  const result = await restricted.query<{
    membership_update: boolean;
    membership_delete: boolean;
    event_read: boolean;
  }>(`
    SELECT has_table_privilege(current_user, 'household.memberships', 'UPDATE') AS membership_update,
           has_table_privilege(current_user, 'household.memberships', 'DELETE') AS membership_delete,
           has_table_privilege(current_user, 'household.events', 'SELECT') AS event_read
  `);
  expect(result.rows[0]).toEqual({
    membership_update: true,
    membership_delete: false,
    event_read: false,
  });
});

test('failed membership insertion rolls back the household and audit event', async () => {
  const name = `Rollback ${randomUUID()}`;
  await expect(
    app.get(HouseholdService).create(randomUUID(), name),
  ).rejects.toThrow();
  const remaining = await admin.query<{ count: string }>(
    'SELECT count(*) FROM household.households WHERE name = $1',
    [name],
  );
  expect(remaining.rows[0].count).toBe('0');
});

test('creates, lists and reads only authorized households; role controls rename', async () => {
  const first = await request(app.getHttpServer())
    .post('/api/households')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[0].cookie!)
    .send({ name: '  Casa A  ' })
    .expect(201);
  const a = first.body.id as string;
  householdIds.push(a);
  expect(first.body).toEqual({ id: a, name: 'Casa A', role: 'OWNER' });
  expect(first.headers['cache-control']).toBe('no-store');
  const second = await request(app.getHttpServer())
    .post('/api/households')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[1].cookie!)
    .send({ name: 'Casa B' })
    .expect(201);
  const b = second.body.id as string;
  householdIds.push(b);

  const own = await request(app.getHttpServer())
    .get('/api/households')
    .set('Cookie', users[0].cookie!)
    .expect(200);
  expect(own.body).toEqual([{ id: a, name: 'Casa A', role: 'OWNER' }]);
  const missing = await request(app.getHttpServer())
    .get(`/api/households/${randomUUID()}`)
    .set('Cookie', users[0].cookie!)
    .expect(404);
  const denied = await request(app.getHttpServer())
    .get(`/api/households/${b}`)
    .set('Cookie', users[0].cookie!)
    .expect(404);
  expect(denied.body).toEqual(missing.body);
  await patch(b, users[0].cookie!, 'Crossed').expect(404);
  await request(app.getHttpServer()).get('/api/households').expect(401);
  await request(app.getHttpServer())
    .post('/api/households')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[0].cookie!)
    .send({ name: '   ' })
    .expect(400);
  await request(app.getHttpServer())
    .post('/api/households')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[0].cookie!)
    .send({ name: 'Casa\u0000invalida' })
    .expect(400);
  await request(app.getHttpServer())
    .get('/api/households/invalido')
    .set('Cookie', users[0].cookie!)
    .expect(400);
  await patch(a, users[0].cookie!, 'Casa\u0000invalida').expect(400);

  await admin.query(
    "INSERT INTO household.memberships(household_id, user_id, role) VALUES ($1, $2, 'VIEWER')",
    [a, users[1].id],
  );
  const shared = await request(app.getHttpServer())
    .get('/api/households')
    .set('Cookie', users[1].cookie!)
    .expect(200);
  expect(shared.body.map((row: { id: string }) => row.id).sort()).toEqual(
    [a, b].sort(),
  );
  await patch(a, users[1].cookie!, 'Denied').expect(403);
  await admin.query(
    "UPDATE household.memberships SET role = 'MEMBER' WHERE household_id = $1 AND user_id = $2",
    [a, users[1].id],
  );
  await patch(a, users[1].cookie!, 'Still denied').expect(403);
  await patch(a, users[0].cookie!, 'Renamed A').expect(200);
  const events = await admin.query<{ kind: string }>(
    'SELECT kind FROM household.events WHERE household_id = $1 ORDER BY created_at',
    [a],
  );
  expect(events.rows.map(({ kind }) => kind)).toEqual(['created', 'renamed']);
});

test('revocation wins before authorization and the same session loses access', async () => {
  const id = householdIds[0];
  const blocker = await admin.connect();
  const inspector = await admin.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      `UPDATE household.memberships SET active = false
       WHERE household_id = $1 AND user_id = $2`,
      [id, users[0].id],
    );
    const lock = await blocker.query<{ xid: string }>(
      "SELECT transactionid::text AS xid FROM pg_locks WHERE pid = pg_backend_pid() AND locktype = 'transactionid' AND granted",
    );
    const pending = patch(id, users[0].cookie!, 'Too late').then(
      (response) => response,
    );
    await waitForTransactionWait(inspector, lock.rows[0].xid);
    await blocker.query('COMMIT');
    await pending.then((response) => expect(response.status).toBe(404));
    await request(app.getHttpServer())
      .get(`/api/households/${id}`)
      .set('Cookie', users[0].cookie!)
      .expect(404);
    await admin.query(
      "UPDATE household.memberships SET active = true, role = 'VIEWER' WHERE household_id = $1 AND user_id = $2",
      [id, users[0].id],
    );
    await request(app.getHttpServer())
      .get(`/api/households/${id}`)
      .set('Cookie', users[0].cookie!)
      .expect(200);
    await patch(id, users[0].cookie!, 'Downgraded').expect(403);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    inspector.release();
  }
});

test('authorized write commits before a concurrent revocation of the locked membership', async () => {
  const id = householdIds[1];
  const holder = await admin.connect();
  const inspector = await admin.connect();
  const revoker = await admin.connect();
  try {
    await holder.query('BEGIN');
    await holder.query(
      'SELECT id FROM household.households WHERE id = $1 FOR UPDATE',
      [id],
    );
    const writing = patch(id, users[1].cookie!, 'Before revoke').then(
      (response) => response,
    );

    let shareHeld = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        await inspector.query(
          'SELECT role FROM household.memberships WHERE household_id = $1 AND user_id = $2 FOR UPDATE NOWAIT',
          [id, users[1].id],
        );
      } catch (error) {
        if ((error as { code?: string }).code !== '55P03') throw error;
        shareHeld = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(shareHeld).toBe(true);

    await revoker.query('BEGIN');
    const revoking = revoker.query(
      'UPDATE household.memberships SET active = false WHERE household_id = $1 AND user_id = $2',
      [id, users[1].id],
    );
    await holder.query('COMMIT');
    expect((await writing).status).toBe(200);
    await revoking;
    await revoker.query('COMMIT');
    await request(app.getHttpServer())
      .get(`/api/households/${id}`)
      .set('Cookie', users[1].cookie!)
      .expect(404);
  } finally {
    await holder.query('ROLLBACK');
    await revoker.query('ROLLBACK');
    holder.release();
    inspector.release();
    revoker.release();
  }
});
