import { randomUUID } from 'node:crypto';
import { setMaxListeners } from 'node:events';
import { INestApplication, Logger } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import pg from 'pg';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http/configure-http.js';

config({ path: '../.env', quiet: true });
const adminUrl = process.env.PRUMO_DATABASE_URL;
const appUrl = process.env.PRUMO_APP_DATABASE_URL;
if (!adminUrl || !appUrl)
  throw new Error('PRUMO_DATABASE_URL and PRUMO_APP_DATABASE_URL are required');
const admin = new pg.Pool({ connectionString: adminUrl });
const restricted = new pg.Pool({ connectionString: appUrl });
const password = 'manual-income-test-password-long-enough';
const users: { id: string; email: string; cookie: string }[] = [];
const houses: string[] = [];
const accounts: string[] = [];
let siblingAccount: string;
let app: INestApplication<App>;

const base = {
  amountCents: '20000',
  currency: 'BRL',
  effectiveDate: '2026-02-01',
  description: 'Receita manual',
};

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

function income(house: string, cookie: string, key: string, body: object) {
  return request(app.getHttpServer())
    .post(`/api/households/${house}/transactions/income`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .set('Idempotency-Key', key)
    .send(body);
}

function balance(house: string, account: string, cookie: string, date: string) {
  return request(app.getHttpServer())
    .get(`/api/households/${house}/accounts/${account}/balance`)
    .query({ date })
    .set('Cookie', cookie);
}

async function waitForBlocked(count: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await admin.query<{ count: string }>(`
      SELECT count(*) AS count FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND usename IN ('prumo_app', 'prumo_migrator')
        AND pid <> pg_backend_pid()
    `);
    if (Number(result.rows[0].count) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected ${count} blocked database sessions`);
}

beforeAll(async () => {
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  for (let index = 0; index < 2; index += 1) {
    const email = `income-${randomUUID()}@prumo.test`;
    const user = await admin.query<{ id: string }>(
      `INSERT INTO identity.users(email, email_normalized, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [email, email, hash],
    );
    users.push({ id: user.rows[0].id, email, cookie: '' });
    const house = await admin.query<{ id: string }>(
      'INSERT INTO household.households(name) VALUES ($1) RETURNING id',
      [`Income ${index}`],
    );
    houses.push(house.rows[0].id);
    await admin.query(
      `INSERT INTO household.memberships(household_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [houses[index], users[index].id],
    );
    const account = await admin.query<{ id: string }>(
      `INSERT INTO finance.accounts(
        household_id, created_by_user_id, name, currency,
        opening_date, opening_balance_cents
       ) VALUES ($1, $2, $3, 'BRL', '2026-02-01', 500000) RETURNING id`,
      [houses[index], users[index].id, `Income account ${index}`],
    );
    accounts.push(account.rows[0].id);
  }
  await admin.query(
    `INSERT INTO household.memberships(household_id, user_id, role)
     VALUES ($1, $2, 'VIEWER')`,
    [houses[0], users[1].id],
  );
  const sibling = await admin.query<{ id: string }>(
    `INSERT INTO finance.accounts(
      household_id, created_by_user_id, name, currency,
      opening_date, opening_balance_cents
     ) VALUES ($1, $2, 'Other account', 'BRL', '2026-02-01', 100000) RETURNING id`,
    [houses[0], users[0].id],
  );
  siblingAccount = sibling.rows[0].id;
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
  const cleanup = await admin.connect();
  try {
    await cleanup.query('BEGIN');
    for (const house of houses) {
      await cleanup.query(
        'DELETE FROM finance.income_requests WHERE household_id = $1',
        [house],
      );
      await cleanup.query(
        'DELETE FROM finance.movements WHERE household_id = $1',
        [house],
      );
      await cleanup.query(
        'DELETE FROM finance.event_versions WHERE household_id = $1',
        [house],
      );
      await cleanup.query(
        'DELETE FROM finance.events WHERE household_id = $1',
        [house],
      );
      await cleanup.query(
        'DELETE FROM finance.accounts WHERE household_id = $1',
        [house],
      );
      await cleanup.query(
        'DELETE FROM household.memberships WHERE household_id = $1',
        [house],
      );
      await cleanup.query('DELETE FROM household.households WHERE id = $1', [
        house,
      ]);
    }
    await cleanup.query('COMMIT');
  } finally {
    await cleanup.query('ROLLBACK');
    cleanup.release();
  }
  for (const user of users)
    await admin.query('DELETE FROM identity.users WHERE id = $1', [user.id]);
  await restricted.end();
  await admin.end();
});

test('applies income on opening day and preserves a pre-opening candidate without effects', async () => {
  const applied = await income(houses[0], users[0].cookie, randomUUID(), {
    ...base,
    accountId: accounts[0],
  }).expect(201);
  expect(applied.body).toMatchObject({
    type: 'RECEIVED_INCOME',
    state: 'APPLIED',
    pendingReason: null,
    version: 1,
    amountCents: '20000',
    currency: 'BRL',
    effectiveDate: '2026-02-01',
    dateProvenance: 'MANUAL_USER',
  });
  expect(applied.body.eventId).not.toBe(applied.body.movementId);
  expect(applied.headers['cache-control']).toBe('no-store');
  const before = await balance(
    houses[0],
    accounts[0],
    users[0].cookie,
    '2026-01-31',
  ).expect(200);
  expect(before.body).toEqual({
    currency: 'BRL',
    date: '2026-01-31',
    openingDate: '2026-02-01',
    openingBalanceCents: '500000',
    calculable: false,
    balanceCents: null,
  });
  const onDay = await balance(
    houses[0],
    accounts[0],
    users[0].cookie,
    '2026-02-01',
  ).expect(200);
  expect(onDay.body.balanceCents).toBe('520000');
  const other = await balance(
    houses[1],
    accounts[1],
    users[1].cookie,
    '2026-02-01',
  ).expect(200);
  expect(other.body.balanceCents).toBe('500000');
  const sibling = await balance(
    houses[0],
    siblingAccount,
    users[0].cookie,
    '2026-02-01',
  ).expect(200);
  expect(sibling.body.balanceCents).toBe('100000');

  const key = randomUUID();
  const pending = await income(houses[0], users[0].cookie, key, {
    ...base,
    accountId: accounts[0],
    effectiveDate: '2026-01-31',
  }).expect(201);
  expect(pending.body.state).toBe('PENDING_PRE_OPENING');
  expect(pending.body.pendingReason).toBe('PRE_OPENING');
  expect(pending.body.movementId).toBeTruthy();
  const unchanged = await balance(
    houses[0],
    accounts[0],
    users[0].cookie,
    '2026-02-01',
  ).expect(200);
  expect(unchanged.body.balanceCents).toBe('520000');
  const replay = await income(houses[0], users[0].cookie, key, {
    ...base,
    accountId: accounts[0],
    effectiveDate: '2026-01-31',
  }).expect(201);
  expect(replay.body).toEqual(pending.body);
  const incomeMonth = await admin.query<{ cents: string }>(
    `SELECT COALESCE(sum(amount_cents::numeric), 0)::text AS cents
     FROM finance.event_versions
     WHERE household_id = $1 AND state = 'APPLIED'
       AND effective_date >= '2026-02-01' AND effective_date < '2026-03-01'`,
    [houses[0]],
  );
  expect(incomeMonth.rows[0].cents).toBe('20000');
});

test('serializes retries, survives a new application instance and pages applied and pending movements', async () => {
  const key = randomUUID();
  const body = { ...base, accountId: accounts[0], effectiveDate: '2026-02-02' };
  const responses = await Promise.all(
    Array.from({ length: 10 }, () =>
      income(houses[0], users[0].cookie, key, body),
    ),
  );
  for (const response of responses) {
    expect(response.status).toBe(201);
    expect(response.body).toEqual(responses[0].body);
  }
  const eventId = responses[0].body.eventId as string;
  const eventCount = await admin.query<{ count: string }>(
    'SELECT count(*) FROM finance.income_requests WHERE household_id = $1 AND request_key = $2',
    [houses[0], key],
  );
  expect(eventCount.rows[0].count).toBe('1');
  await app.close();
  app = await startApp();
  const replay = await income(houses[0], users[0].cookie, key, body).expect(
    201,
  );
  expect(replay.body.eventId).toBe(eventId);
  await income(houses[0], users[0].cookie, key, {
    ...body,
    amountCents: '20001',
  }).expect(409);
  const distinct = await income(
    houses[0],
    users[0].cookie,
    randomUUID(),
    body,
  ).expect(201);
  expect(distinct.body.eventId).not.toBe(eventId);
  const first = await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/accounts/${accounts[0]}/movements`)
    .query({ limit: 2 })
    .set('Cookie', users[0].cookie)
    .expect(200);
  expect(first.body.items).toHaveLength(2);
  expect(first.body.items[0].state).toBe('PENDING_PRE_OPENING');
  expect(first.body.nextCursor).toBeTruthy();
  const second = await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/accounts/${accounts[0]}/movements`)
    .query({ limit: 2, cursor: first.body.nextCursor })
    .set('Cookie', users[0].cookie)
    .expect(200);
  expect(second.body.items).toHaveLength(2);
  expect(
    second.body.items.map((item: { eventId: string }) => item.eventId),
  ).toEqual(
    responses
      .map((response) => response.body.eventId)
      .slice(0, 1)
      .concat(distinct.body.eventId),
  );
  const detail = await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/transactions/${eventId}`)
    .set('Cookie', users[0].cookie)
    .expect(200);
  expect(detail.body).toEqual(responses[0].body);
});

test('validates amount, day, cursor and scope; viewer cannot write', async () => {
  for (const amountCents of ['0', '-1', '01', '1.5', '9007199254740992']) {
    await income(houses[0], users[0].cookie, randomUUID(), {
      ...base,
      accountId: accounts[0],
      amountCents,
    }).expect(400);
  }
  for (const effectiveDate of ['0000-01-01', '2026-02-30', '2026-13-01']) {
    await income(houses[0], users[0].cookie, randomUUID(), {
      ...base,
      accountId: accounts[0],
      effectiveDate,
    }).expect(400);
  }
  await income(houses[0], users[0].cookie, randomUUID(), {
    ...base,
    accountId: accounts[1],
  }).expect(404);
  await income(houses[0], users[1].cookie, randomUUID(), {
    ...base,
    accountId: accounts[0],
  }).expect(403);
  const missing = await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/transactions/${randomUUID()}`)
    .set('Cookie', users[0].cookie)
    .expect(404);
  const foreign = await income(houses[1], users[1].cookie, randomUUID(), {
    ...base,
    accountId: accounts[1],
  }).expect(201);
  const denied = await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/transactions/${foreign.body.eventId}`)
    .set('Cookie', users[0].cookie)
    .expect(404);
  expect(denied.body).toEqual(missing.body);
  await balance(houses[0], accounts[1], users[0].cookie, '2026-02-01').expect(
    404,
  );
  await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/accounts/${accounts[0]}/movements`)
    .query({ cursor: '2026-02-01:9223372036854775808' })
    .set('Cookie', users[0].cookie)
    .expect(400);
  await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/accounts/${accounts[0]}/movements`)
    .query({ limit: 101 })
    .set('Cookie', users[0].cookie)
    .expect(400);
  await balance(houses[0], accounts[0], users[0].cookie, '0000-01-01').expect(
    400,
  );
  await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/accounts/${accounts[0]}/movements`)
    .expect(401);
});

test('uses exact numeric aggregation above the individual amount limit', async () => {
  const maximum = '9007199254740991';
  await income(houses[0], users[0].cookie, randomUUID(), {
    ...base,
    accountId: accounts[0],
    amountCents: maximum,
    effectiveDate: '2026-02-03',
  }).expect(201);
  const response = await balance(
    houses[0],
    accounts[0],
    users[0].cookie,
    '2026-02-03',
  ).expect(200);
  expect(response.body.balanceCents).toBe('9007199255300991');
});

test('revocation committed first blocks income; a write holding membership commits first', async () => {
  const blocker = await admin.connect();
  const revoker = await admin.connect();
  const firstKey = randomUUID();
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      'UPDATE household.memberships SET active = false WHERE household_id = $1 AND user_id = $2',
      [houses[0], users[0].id],
    );
    const pending = income(houses[0], users[0].cookie, firstKey, {
      ...base,
      accountId: accounts[0],
    }).then((response) => response);
    await waitForBlocked(1);
    await blocker.query('COMMIT');
    expect((await pending).status).toBe(404);
    await admin.query(
      'UPDATE household.memberships SET active = true WHERE household_id = $1 AND user_id = $2',
      [houses[0], users[0].id],
    );
    const key = randomUUID();
    await blocker.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
      `${houses[0]}:income:create:${key}`,
    ]);
    const writing = income(houses[0], users[0].cookie, key, {
      ...base,
      accountId: accounts[0],
    }).then((response) => response);
    await waitForBlocked(1);
    await revoker.query('BEGIN');
    const revocation = revoker.query(
      'UPDATE household.memberships SET active = false WHERE household_id = $1 AND user_id = $2',
      [houses[0], users[0].id],
    );
    await waitForBlocked(2);
    await blocker.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
      `${houses[0]}:income:create:${key}`,
    ]);
    const written = await writing;
    expect(written.status).toBe(201);
    await revocation;
    await revoker.query('COMMIT');
    await income(houses[0], users[0].cookie, key, {
      ...base,
      accountId: accounts[0],
    }).expect(404);
    await balance(houses[0], accounts[0], users[0].cookie, '2026-02-03').expect(
      404,
    );
    await admin.query(
      'UPDATE household.memberships SET active = true WHERE household_id = $1 AND user_id = $2',
      [houses[0], users[0].id],
    );
  } finally {
    await blocker.query('SELECT pg_advisory_unlock_all()');
    await blocker.query('ROLLBACK');
    await revoker.query('ROLLBACK');
    blocker.release();
    revoker.release();
  }
});

test('deferred links reject cross-household movement and rollback a failed insert', async () => {
  const client = await restricted.connect();
  try {
    const role = await client.query<{
      current_user: string;
      rolbypassrls: boolean;
    }>(
      'SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user',
    );
    expect(role.rows[0]).toEqual({
      current_user: 'prumo_app',
      rolbypassrls: false,
    });
    await client.query('BEGIN');
    const eventId = randomUUID();
    const movementId = randomUUID();
    await client.query(
      `INSERT INTO finance.events(id, household_id, type) VALUES ($1, $2, 'RECEIVED_INCOME')`,
      [eventId, houses[0]],
    );
    await expect(
      client.query(
        `INSERT INTO finance.event_versions(
         household_id,event_id,version,movement_id,account_id,amount_cents,
         currency,effective_date,description,state,date_provenance,recorded_by_user_id
       ) VALUES ($1,$2,1,$3,$4,100,'BRL','2026-02-01','cross','APPLIED','MANUAL_USER',$5)`,
        [houses[0], eventId, movementId, accounts[1], users[0].id],
      ),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
    const rolledBack = await admin.query<{ count: string }>(
      'SELECT count(*) FROM finance.events WHERE household_id = $1 AND id = $2',
      [houses[0], eventId],
    );
    expect(rolledBack.rows[0].count).toBe('0');
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO finance.events(id, household_id, type) VALUES ($1, $2, 'RECEIVED_INCOME')`,
      [randomUUID(), houses[0]],
    );
    await expect(client.query('COMMIT')).rejects.toThrow();
    await client.query('ROLLBACK');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('failed request insert rolls back the HTTP write and does not log financial input', async () => {
  const key = randomUUID();
  const description = `private-income-${randomUUID()}`;
  const amountCents = '1234567';
  const body = { ...base, accountId: accounts[0], description, amountCents };
  const counts = async () => {
    const result = await admin.query<{
      events: string;
      versions: string;
      movements: string;
      requests: string;
    }>(
      `SELECT
        (SELECT count(*) FROM finance.events WHERE household_id = $1) AS events,
        (SELECT count(*) FROM finance.event_versions WHERE household_id = $1) AS versions,
        (SELECT count(*) FROM finance.movements WHERE household_id = $1) AS movements,
        (SELECT count(*) FROM finance.income_requests WHERE household_id = $1) AS requests`,
      [houses[0]],
    );
    return result.rows[0];
  };
  const before = await counts();
  await admin.query(`
    CREATE FUNCTION finance.reject_income_request_test() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'injected income request failure';
    END $$;
    CREATE TRIGGER reject_income_request_test
    BEFORE INSERT ON finance.income_requests
    FOR EACH ROW EXECUTE FUNCTION finance.reject_income_request_test();
  `);
  const log = vi.spyOn(Logger.prototype, 'error');
  try {
    const failed = await income(houses[0], users[0].cookie, key, body).expect(
      500,
    );
    expect(failed.body.message).toBe('Financial operation failed');
    expect(JSON.stringify(failed.body)).not.toContain(description);
    expect(JSON.stringify(failed.body)).not.toContain(amountCents);
    expect(await counts()).toEqual(before);
    expect(JSON.stringify(log.mock.calls)).not.toContain(description);
    expect(JSON.stringify(log.mock.calls)).not.toContain(amountCents);
  } finally {
    log.mockRestore();
    await admin.query(`
      DROP TRIGGER reject_income_request_test ON finance.income_requests;
      DROP FUNCTION finance.reject_income_request_test();
    `);
  }
  await income(houses[0], users[0].cookie, key, body).expect(201);
});
