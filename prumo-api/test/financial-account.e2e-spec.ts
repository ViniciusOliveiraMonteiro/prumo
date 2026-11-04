import { randomUUID } from 'node:crypto';
import { setMaxListeners } from 'node:events';
import { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import pg from 'pg';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http/configure-http.js';

config({ path: '../.env', quiet: true });
const adminUrl = process.env.PRUMO_DATABASE_URL;
const appUrl = process.env.PRUMO_APP_DATABASE_URL;
if (!adminUrl || !appUrl)
  throw new Error('PRUMO_DATABASE_URL and PRUMO_APP_DATABASE_URL are required');
const admin = new pg.Pool({ connectionString: adminUrl });
const restricted = new pg.Pool({ connectionString: appUrl });
const password = 'financial-account-test-password-long-enough';
const users: { id: string; email: string; cookie: string }[] = [];
const households: string[] = [];
let app: INestApplication<App>;

function post(householdId: string, cookie: string, key: string, body: object) {
  return request(app.getHttpServer())
    .post(`/api/households/${householdId}/accounts`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .set('Idempotency-Key', key)
    .send(body);
}

const accountBody = {
  name: 'Conta compartilhada',
  currency: 'BRL',
  openingDate: '2026-11-03',
  openingBalanceCents: '-9007199254740991',
};

async function blockedCount(): Promise<number> {
  const result = await admin.query<{ count: string }>(`
    SELECT count(*) AS count FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock'
      AND usename IN ('prumo_app', 'prumo_migrator')
      AND pid <> pg_backend_pid()
  `);
  return Number(result.rows[0].count);
}

async function waitForBlocked(count: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await blockedCount()) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected ${count} blocked database sessions`);
}

async function startApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const server = moduleRef.createNestApplication();
  configureHttp(server);
  await server.init();
  setMaxListeners(20, server.getHttpServer());
  return server;
}

beforeAll(async () => {
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  for (let index = 0; index < 2; index += 1) {
    const email = `finance-${randomUUID()}@prumo.test`;
    const result = await admin.query<{ id: string }>(
      `INSERT INTO identity.users(email, email_normalized, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [email, email, hash],
    );
    users.push({ id: result.rows[0].id, email, cookie: '' });
    const house = await admin.query<{ id: string }>(
      'INSERT INTO household.households(name) VALUES ($1) RETURNING id',
      [`Finance ${index}`],
    );
    households.push(house.rows[0].id);
    await admin.query(
      `INSERT INTO household.memberships(household_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [house.rows[0].id, users[index].id],
    );
  }
  await admin.query(
    `INSERT INTO household.memberships(household_id, user_id, role)
     VALUES ($1, $2, 'VIEWER')`,
    [households[0], users[1].id],
  );
  app = await startApp();
  for (const user of users) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .set('Host', 'localhost:3000')
      .set('Origin', 'http://localhost:3000')
      .send({ email: user.email, password })
      .expect(200);
    const cookie = response.headers['set-cookie'];
    user.cookie = Array.isArray(cookie) ? cookie[0] : cookie;
  }
});

afterAll(async () => {
  await app?.close();
  for (const householdId of households) {
    await admin.query(
      'DELETE FROM finance.account_requests WHERE household_id = $1',
      [householdId],
    );
    await admin.query('DELETE FROM finance.accounts WHERE household_id = $1', [
      householdId,
    ]);
    await admin.query(
      'DELETE FROM household.memberships WHERE household_id = $1',
      [householdId],
    );
    await admin.query('DELETE FROM household.households WHERE id = $1', [
      householdId,
    ]);
  }
  for (const user of users)
    await admin.query('DELETE FROM identity.users WHERE id = $1', [user.id]);
  await restricted.end();
  await admin.end();
});

test('creates once under concurrent retries and scopes reads to the selected household', async () => {
  const key = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      post(households[0], users[0].cookie, key, accountBody),
    ),
  );
  for (const response of results) {
    expect(response.status).toBe(201);
    expect(response.body).toEqual(results[0].body);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  const accountId = results[0].body.id as string;
  expect(results[0].body).toEqual({
    id: accountId,
    openingVersion: 1,
    ...accountBody,
  });
  const count = await admin.query<{ count: string }>(
    'SELECT count(*) FROM finance.accounts WHERE household_id = $1',
    [households[0]],
  );
  expect(count.rows[0].count).toBe('1');
  const replay = await post(households[0], users[0].cookie, key, accountBody);
  expect(replay.status).toBe(201);
  expect(replay.body.id).toBe(accountId);
  await app.close();
  app = await startApp();
  const afterRestart = await post(
    households[0],
    users[0].cookie,
    key,
    accountBody,
  ).expect(201);
  expect(afterRestart.body.id).toBe(accountId);
  await post(households[0], users[0].cookie, key, {
    ...accountBody,
    name: 'Outra conta',
  }).expect(409);
  await post(households[0], users[1].cookie, key, accountBody).expect(403);

  const own = await request(app.getHttpServer())
    .get(`/api/households/${households[0]}/accounts`)
    .set('Cookie', users[0].cookie)
    .expect(200);
  expect(own.body).toEqual([results[0].body]);
  const viewer = await request(app.getHttpServer())
    .get(`/api/households/${households[0]}/accounts/${accountId}`)
    .set('Cookie', users[1].cookie)
    .expect(200);
  expect(viewer.body).toEqual(results[0].body);
  const missing = await request(app.getHttpServer())
    .get(`/api/households/${households[1]}/accounts/${randomUUID()}`)
    .set('Cookie', users[1].cookie)
    .expect(404);
  const foreign = await request(app.getHttpServer())
    .get(`/api/households/${households[1]}/accounts/${accountId}`)
    .set('Cookie', users[1].cookie)
    .expect(404);
  expect(foreign.body).toEqual(missing.body);
  await request(app.getHttpServer())
    .get(`/api/households/${households[1]}/accounts`)
    .set('Cookie', users[0].cookie)
    .expect(404);
  await request(app.getHttpServer())
    .get(`/api/households/${households[0]}/accounts`)
    .expect(401);
  await post(households[0], users[1].cookie, randomUUID(), accountBody).expect(
    403,
  );

  await admin.query(
    `UPDATE household.memberships SET role = 'MEMBER'
     WHERE household_id = $1 AND user_id = $2`,
    [households[0], users[1].id],
  );
  await post(households[0], users[1].cookie, key, accountBody).expect(409);
  const second = await post(
    households[0],
    users[1].cookie,
    randomUUID(),
    accountBody,
  ).expect(201);
  expect(second.body.id).not.toBe(accountId);
  const otherHousehold = await post(
    households[1],
    users[1].cookie,
    key,
    accountBody,
  ).expect(201);
  expect(otherHousehold.body.id).not.toBe(accountId);
  const isolated = await request(app.getHttpServer())
    .get(`/api/households/${households[1]}/accounts`)
    .set('Cookie', users[1].cookie)
    .expect(200);
  expect(isolated.body).toEqual([otherHousehold.body]);
});

test('validates money and date without converting cents to a JSON number', async () => {
  for (const cents of ['0', '9007199254740991']) {
    const accepted = await post(households[0], users[0].cookie, randomUUID(), {
      ...accountBody,
      openingBalanceCents: cents,
    }).expect(201);
    expect(accepted.body.openingBalanceCents).toBe(cents);
  }
  for (const cents of [
    '-0',
    '01',
    '1.5',
    '9007199254740992',
    '-9007199254740992',
  ]) {
    await post(households[0], users[0].cookie, randomUUID(), {
      ...accountBody,
      openingBalanceCents: cents,
    }).expect(400);
  }
  for (const date of ['0000-01-01', '2026-02-30', '2026-13-01', '2026-1-1']) {
    await post(households[0], users[0].cookie, randomUUID(), {
      ...accountBody,
      openingDate: date,
    }).expect(400);
  }
  await post(households[0], users[0].cookie, randomUUID(), {
    ...accountBody,
    currency: 'USD',
  }).expect(400);
  await post(households[0], users[0].cookie, randomUUID(), {
    ...accountBody,
    name: '\0invalid',
  }).expect(400);
  await post(households[0], users[0].cookie, randomUUID(), {
    ...accountBody,
    openingBalanceCents: 100,
  }).expect(400);
});

test('failed request record rolls back both the account and idempotency key', async () => {
  const key = randomUUID();
  const before = await admin.query<{ count: string }>(
    'SELECT count(*) FROM finance.accounts WHERE household_id = $1',
    [households[0]],
  );
  await admin.query(`
    CREATE FUNCTION finance.reject_account_request_test() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'injected account request failure';
    END $$;
    CREATE TRIGGER reject_account_request_test
    BEFORE INSERT ON finance.account_requests
    FOR EACH ROW EXECUTE FUNCTION finance.reject_account_request_test();
  `);
  try {
    const failed = await post(
      households[0],
      users[0].cookie,
      key,
      accountBody,
    ).expect(500);
    expect(failed.body.message).toBe('Financial operation failed');
    const state = await admin.query<{ accounts: string; requests: string }>(
      `SELECT
        (SELECT count(*) FROM finance.accounts WHERE household_id = $1) AS accounts,
        (SELECT count(*) FROM finance.account_requests
          WHERE household_id = $1 AND request_key = $2) AS requests`,
      [households[0], key],
    );
    expect(state.rows[0]).toEqual({
      accounts: before.rows[0].count,
      requests: '0',
    });
  } finally {
    await admin.query(`
      DROP TRIGGER reject_account_request_test ON finance.account_requests;
      DROP FUNCTION finance.reject_account_request_test();
    `);
  }
  await post(households[0], users[0].cookie, key, accountBody).expect(201);
});

test('revocation committed first prevents the financial write', async () => {
  const blocker = await admin.connect();
  const before = await admin.query<{ count: string }>(
    'SELECT count(*) FROM finance.accounts WHERE household_id = $1',
    [households[0]],
  );
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      `UPDATE household.memberships SET active = false
       WHERE household_id = $1 AND user_id = $2`,
      [households[0], users[0].id],
    );
    const pending = post(
      households[0],
      users[0].cookie,
      randomUUID(),
      accountBody,
    ).then((r) => r);
    await waitForBlocked(1);
    await blocker.query('COMMIT');
    const response = await pending;
    expect(response.status).toBe(404);
    const after = await admin.query<{ count: string }>(
      'SELECT count(*) FROM finance.accounts WHERE household_id = $1',
      [households[0]],
    );
    expect(after.rows[0].count).toBe(before.rows[0].count);
    await admin.query(
      `UPDATE household.memberships SET active = true
       WHERE household_id = $1 AND user_id = $2`,
      [households[0], users[0].id],
    );
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
});

test('financial write holding membership completes before concurrent revocation', async () => {
  const blocker = await admin.connect();
  const revoker = await admin.connect();
  const key = randomUUID();
  let pending: Promise<request.Response> | undefined;
  let revocation: Promise<pg.QueryResult> | undefined;
  try {
    await blocker.query(`SELECT pg_advisory_lock(hashtextextended($1, 0))`, [
      `${households[0]}:account:create:${key}`,
    ]);
    pending = post(households[0], users[0].cookie, key, accountBody).then(
      (r) => r,
    );
    await waitForBlocked(1);
    await revoker.query('BEGIN');
    revocation = revoker.query(
      `UPDATE household.memberships SET active = false
       WHERE household_id = $1 AND user_id = $2`,
      [households[0], users[0].id],
    );
    await waitForBlocked(2);
    await blocker.query(`SELECT pg_advisory_unlock(hashtextextended($1, 0))`, [
      `${households[0]}:account:create:${key}`,
    ]);
    const response = await pending;
    expect(response.status).toBe(201);
    await revocation;
    await revoker.query('COMMIT');
    await request(app.getHttpServer())
      .get(`/api/households/${households[0]}/accounts/${response.body.id}`)
      .set('Cookie', users[0].cookie)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/households/${households[0]}/accounts`)
      .set('Cookie', users[0].cookie)
      .expect(404);
    await post(households[0], users[0].cookie, key, accountBody).expect(404);
    await admin.query(
      `UPDATE household.memberships SET active = true
       WHERE household_id = $1 AND user_id = $2`,
      [households[0], users[0].id],
    );
  } finally {
    await blocker.query(`SELECT pg_advisory_unlock(hashtextextended($1, 0))`, [
      `${households[0]}:account:create:${key}`,
    ]);
    await revoker.query('ROLLBACK');
    blocker.release();
    revoker.release();
  }
});

test('application role lacks owner and bypass privileges on financial accounts', async () => {
  const permissions = await restricted.query<{
    current_user: string;
    rolbypassrls: boolean;
    owner: boolean;
    can_delete: boolean;
  }>(`
    SELECT current_user, rolbypassrls,
           pg_has_role(current_user, c.relowner, 'MEMBER') AS owner,
           has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.rolname = current_user
    WHERE n.nspname = 'finance' AND c.relname = 'accounts'
  `);
  expect(permissions.rows[0]).toEqual({
    current_user: 'prumo_app',
    rolbypassrls: false,
    owner: false,
    can_delete: false,
  });
});
