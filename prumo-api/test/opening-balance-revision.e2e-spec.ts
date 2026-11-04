import { randomUUID } from 'node:crypto';
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
if (!process.env.PRUMO_DATABASE_URL || !process.env.PRUMO_APP_DATABASE_URL)
  throw new Error('Local database URLs are required');
const admin = new pg.Pool({ connectionString: process.env.PRUMO_DATABASE_URL });
const restricted = new pg.Pool({
  connectionString: process.env.PRUMO_APP_DATABASE_URL,
});
const users: { id: string; email: string; cookie: string }[] = [];
const houses: string[] = [];
const accounts: string[] = [];
let app: INestApplication<App>;
const password = 'opening-revision-test-password-long-enough';
let lastReplay: { key: string; body: object; response: object };

async function waitForBlocked(count: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await admin.query<{ count: string }>(`
      SELECT count(*) AS count FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND usename IN ('prumo_app', current_user) AND pid <> pg_backend_pid()`);
    if (Number(result.rows[0].count) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected ${count} blocked database sessions`);
}

function revise(
  user: number,
  house: number,
  account: number,
  key: string,
  body: object,
) {
  return request(app.getHttpServer())
    .post(
      `/api/households/${houses[house]}/accounts/${accounts[account]}/opening-balance-revisions`,
    )
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[user].cookie)
    .set('Idempotency-Key', key)
    .send(body);
}
function get(path: string, user = 0) {
  return request(app.getHttpServer())
    .get(path)
    .set('Cookie', users[user].cookie);
}

beforeAll(async () => {
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  for (let i = 0; i < 2; i += 1) {
    const email = `opening-revision-${randomUUID()}@prumo.test`;
    const result = await admin.query<{ id: string }>(
      'INSERT INTO identity.users(email,email_normalized,password_hash) VALUES ($1,$1,$2) RETURNING id',
      [email, hash],
    );
    users.push({ id: result.rows[0].id, email, cookie: '' });
    const house = await admin.query<{ id: string }>(
      'INSERT INTO household.households(name) VALUES ($1) RETURNING id',
      [`Opening revision ${i}`],
    );
    houses.push(house.rows[0].id);
    await admin.query(
      "INSERT INTO household.memberships(household_id,user_id,role) VALUES ($1,$2,'OWNER')",
      [houses[i], users[i].id],
    );
    const account = await admin.query<{ id: string }>(
      "INSERT INTO finance.accounts(household_id,created_by_user_id,name,currency,opening_date,opening_balance_cents) VALUES ($1,$2,'Current','BRL','2026-02-01',500000) RETURNING id",
      [houses[i], users[i].id],
    );
    accounts.push(account.rows[0].id);
  }
  await admin.query(
    "INSERT INTO household.memberships(household_id,user_id,role) VALUES ($1,$2,'VIEWER')",
    [houses[0], users[1].id],
  );
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
        'DELETE FROM finance.opening_balance_revision_requests WHERE household_id = $1',
        [house],
      );
      await cleanup.query(
        'DELETE FROM finance.opening_balance_revisions WHERE household_id = $1',
        [house],
      );
      await cleanup.query(
        'DELETE FROM finance.account_requests WHERE household_id = $1',
        [house],
      );
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
    }
    for (const account of accounts)
      await cleanup.query('DELETE FROM finance.accounts WHERE id = $1', [
        account,
      ]);
    for (const house of houses) {
      await cleanup.query(
        'DELETE FROM household.memberships WHERE household_id = $1',
        [house],
      );
      await cleanup.query('DELETE FROM household.households WHERE id = $1', [
        house,
      ]);
    }
    for (const user of users) {
      await cleanup.query('DELETE FROM identity.sessions WHERE user_id = $1', [
        user.id,
      ]);
      await cleanup.query('DELETE FROM identity.users WHERE id = $1', [
        user.id,
      ]);
    }
    await cleanup.query('COMMIT');
  } finally {
    await cleanup.query('ROLLBACK');
    cleanup.release();
  }
  await admin.end();
  await restricted.end();
});

test('value revision changes derived balance, preserves history, and replays exactly once', async () => {
  const house = houses[0],
    account = accounts[0];
  const income = await request(app.getHttpServer())
    .post(`/api/households/${house}/transactions/income`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[0].cookie)
    .set('Idempotency-Key', randomUUID())
    .send({
      accountId: account,
      amountCents: '20000',
      currency: 'BRL',
      effectiveDate: '2026-02-02',
      description: 'Entrada',
    });
  expect(income.status).toBe(201);
  const key = randomUUID();
  const body = {
    expectedVersion: 1,
    openingBalanceCents: '499000',
    reason: 'Correção informada',
  };
  const first = await revise(0, 0, 0, key, body).expect(201);
  expect(first.body).toMatchObject({
    version: 2,
    previousBalanceCents: '500000',
    openingBalanceCents: '499000',
  });
  expect((await revise(0, 0, 0, key, body).expect(201)).body).toEqual(
    first.body,
  );
  expect(
    (await get(`/api/households/${house}/accounts/${account}`).expect(200)).body
      .openingVersion,
  ).toBe(2);
  expect(
    (
      await get(
        `/api/households/${house}/accounts/${account}/balance?date=2026-02-02`,
      ).expect(200)
    ).body.balanceCents,
  ).toBe('519000');
  expect(
    (
      await get(
        `/api/households/${house}/accounts/${account}/balance?date=2026-01-31`,
      ).expect(200)
    ).body.calculable,
  ).toBe(false);
  const history = await get(
    `/api/households/${house}/accounts/${account}/opening-balance-revisions?limit=1`,
  ).expect(200);
  expect(history.body.items[0]).toMatchObject({
    version: 1,
    openingBalanceCents: '500000',
    revisionId: null,
  });
  expect(history.body.nextCursor).toBe(1);
  const rest = await get(
    `/api/households/${house}/accounts/${account}/opening-balance-revisions?afterVersion=1`,
  ).expect(200);
  expect(rest.body.items).toHaveLength(1);
  expect(rest.body.items[0].revisionId).toBe(first.body.revisionId);
  expect(
    await admin
      .query(
        'SELECT count(*)::integer AS n FROM finance.opening_balance_revisions WHERE account_id = $1',
        [account],
      )
      .then((r) => r.rows[0].n),
  ).toBe(1);
});

test('concurrent revisions have one winner; stale version and changed key conflict', async () => {
  const body = {
    expectedVersion: 2,
    openingBalanceCents: '499100',
    reason: 'Outra correção',
  };
  const key = randomUUID();
  const secondKey = randomUUID();
  const [a, b] = await Promise.all([
    revise(0, 0, 0, key, body),
    revise(0, 0, 0, secondKey, body),
  ]);
  expect([a.status, b.status].sort((left, right) => left - right)).toEqual([
    201, 409,
  ]);
  expect(
    (await revise(0, 0, 0, key, { ...body, reason: 'Outro motivo' })).status,
  ).toBe(409);
  expect((await revise(0, 0, 0, randomUUID(), body)).status).toBe(409);
  const winnerKey = a.status === 201 ? key : secondKey;
  const winner = a.status === 201 ? a.body : b.body;
  await revise(0, 0, 0, randomUUID(), {
    expectedVersion: 3,
    openingBalanceCents: '499200',
    reason: 'Revisão posterior',
  }).expect(201);
  expect((await revise(0, 0, 0, winnerKey, body).expect(201)).body).toEqual(
    winner,
  );
});

test('authorization hides external account and denies viewer writes', async () => {
  const body = {
    expectedVersion: 1,
    openingBalanceCents: '0',
    reason: 'Teste',
  };
  expect((await revise(1, 0, 0, randomUUID(), body)).status).toBe(403);
  expect((await revise(0, 0, 1, randomUUID(), body)).status).toBe(404);
  expect(
    (
      await get(
        `/api/households/${houses[0]}/accounts/${accounts[1]}/opening-balance-revisions`,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await get(
        `/api/households/${houses[0]}/accounts/${accounts[0]}/opening-balance-revisions`,
        1,
      )
    ).status,
  ).toBe(200);
});

test('database role cannot change opening balance without a matching revision', async () => {
  await expect(
    restricted.query(
      'UPDATE finance.accounts SET opening_balance_cents = 1, opening_version = opening_version + 1 WHERE household_id = $1 AND id = $2',
      [houses[0], accounts[0]],
    ),
  ).rejects.toThrow(
    'Opening balance update requires a matching audit revision',
  );
});

test('request cannot link to a revision in another household', async () => {
  const revision = await admin.query<{ id: string }>(
    'SELECT id FROM finance.opening_balance_revisions WHERE account_id = $1 LIMIT 1',
    [accounts[0]],
  );
  await expect(
    restricted.query(
      `
    INSERT INTO finance.opening_balance_revision_requests (
      household_id, request_key, actor_user_id, account_id, request_payload, revision_id, response
    ) VALUES ($1,$2,$3,$4,'{}'::jsonb,$5,'{}'::jsonb)`,
      [houses[1], randomUUID(), users[1].id, accounts[1], revision.rows[0].id],
    ),
  ).rejects.toThrow();
});

test('account creation replay keeps its original opening value after a revision', async () => {
  const key = randomUUID();
  const body = {
    name: 'Replay account',
    currency: 'BRL',
    openingDate: '2026-02-01',
    openingBalanceCents: '1000',
  };
  const create = () =>
    request(app.getHttpServer())
      .post(`/api/households/${houses[0]}/accounts`)
      .set('Host', 'localhost:3000')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', users[0].cookie)
      .set('Idempotency-Key', key)
      .send(body);
  const original = await create().expect(201);
  accounts.push(original.body.id);
  await revise(0, 0, accounts.length - 1, randomUUID(), {
    expectedVersion: 1,
    openingBalanceCents: '2000',
    reason: 'Corrigido',
  }).expect(201);
  expect((await create().expect(201)).body).toEqual(original.body);
  expect(
    (
      await get(
        `/api/households/${houses[0]}/accounts/${original.body.id}`,
      ).expect(200)
    ).body.openingBalanceCents,
  ).toBe('2000');
});

test('accepts signed extremes and zero, rejects invalid input', async () => {
  const account = accounts[0];
  const house = houses[0];
  const current = await get(
    `/api/households/${house}/accounts/${account}`,
  ).expect(200);
  let version = current.body.openingVersion as number;
  for (const value of ['9007199254740991', '-9007199254740991', '0']) {
    const result = await revise(0, 0, 0, randomUUID(), {
      expectedVersion: version,
      openingBalanceCents: value,
      reason: 'Valor corrigido',
    }).expect(201);
    version += 1;
    expect(result.body.version).toBe(version);
    expect(
      (
        await get(
          `/api/households/${house}/accounts/${account}/balance?date=2026-02-01`,
        ).expect(200)
      ).body.balanceCents,
    ).toBe(value);
  }
  for (const invalid of [
    { expectedVersion: version, openingBalanceCents: '1.5', reason: 'Erro' },
    {
      expectedVersion: version,
      openingBalanceCents: '9007199254740992',
      reason: 'Erro',
    },
    { expectedVersion: version, openingBalanceCents: '1', reason: '  ' },
  ])
    expect((await revise(0, 0, 0, randomUUID(), invalid)).status).toBe(400);
});

test('failure while storing request rolls back balance and audit row', async () => {
  const account = accounts[0];
  const house = houses[0];
  const before = (
    await get(`/api/households/${house}/accounts/${account}`).expect(200)
  ).body;
  const key = randomUUID();
  const body = {
    expectedVersion: before.openingVersion,
    openingBalanceCents: '1234',
    reason: 'Rollback',
  };
  await admin.query(
    `CREATE FUNCTION finance.reject_opening_revision_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected request failure'; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER reject_opening_revision_test BEFORE INSERT ON finance.opening_balance_revision_requests FOR EACH ROW EXECUTE FUNCTION finance.reject_opening_revision_test()',
  );
  try {
    expect((await revise(0, 0, 0, key, body)).status).toBe(500);
  } finally {
    await admin.query(
      'DROP TRIGGER reject_opening_revision_test ON finance.opening_balance_revision_requests',
    );
    await admin.query('DROP FUNCTION finance.reject_opening_revision_test()');
  }
  const after = (
    await get(`/api/households/${house}/accounts/${account}`).expect(200)
  ).body;
  expect(after.openingVersion).toBe(before.openingVersion);
  expect(after.openingBalanceCents).toBe(before.openingBalanceCents);
  expect(
    (
      await admin.query(
        'SELECT count(*)::integer AS n FROM finance.opening_balance_revisions WHERE account_id = $1 AND version = $2',
        [account, before.openingVersion + 1],
      )
    ).rows[0].n,
  ).toBe(0);
  const success = await revise(0, 0, 0, key, body).expect(201);
  lastReplay = { key, body, response: success.body };
});

test('revocation committed first prevents a revision', async () => {
  const blocker = await admin.connect();
  const before = (
    await get(`/api/households/${houses[0]}/accounts/${accounts[0]}`).expect(
      200,
    )
  ).body;
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      'UPDATE household.memberships SET active = false WHERE household_id = $1 AND user_id = $2',
      [houses[0], users[0].id],
    );
    const pending = revise(0, 0, 0, randomUUID(), {
      expectedVersion: before.openingVersion,
      openingBalanceCents: '4321',
      reason: 'Revogação',
    }).then((result) => result);
    await waitForBlocked(1);
    await blocker.query('COMMIT');
    expect((await pending).status).toBe(404);
    const after = (
      await get(
        `/api/households/${houses[0]}/accounts/${accounts[0]}`,
        1,
      ).expect(200)
    ).body;
    expect(after.openingVersion).toBe(before.openingVersion);
    await admin.query(
      'UPDATE household.memberships SET active = true WHERE household_id = $1 AND user_id = $2',
      [houses[0], users[0].id],
    );
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
});

test('revision holding membership completes before concurrent revocation', async () => {
  const blocker = await admin.connect();
  const revoker = await admin.connect();
  const before = (
    await get(`/api/households/${houses[0]}/accounts/${accounts[0]}`).expect(
      200,
    )
  ).body;
  const key = randomUUID();
  const body = {
    expectedVersion: before.openingVersion,
    openingBalanceCents: '5432',
    reason: 'Antes da revogação',
  };
  const lockName = `${houses[0]}:account:opening-balance:revise:${key}`;
  try {
    await blocker.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
      lockName,
    ]);
    const pending = revise(0, 0, 0, key, body).then((result) => result);
    await waitForBlocked(1);
    await revoker.query('BEGIN');
    const revocation = revoker.query(
      'UPDATE household.memberships SET active = false WHERE household_id = $1 AND user_id = $2',
      [houses[0], users[0].id],
    );
    await waitForBlocked(2);
    await blocker.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
      lockName,
    ]);
    const response = await pending;
    expect(response.status).toBe(201);
    await revocation;
    await revoker.query('COMMIT');
    expect((await revise(0, 0, 0, key, body)).status).toBe(404);
    await admin.query(
      'UPDATE household.memberships SET active = true WHERE household_id = $1 AND user_id = $2',
      [houses[0], users[0].id],
    );
  } finally {
    await blocker.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
      lockName,
    ]);
    await revoker.query('ROLLBACK');
    blocker.release();
    revoker.release();
  }
});

test('replay survives a new application instance', async () => {
  await app.close();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.init();
  expect(
    (await revise(0, 0, 0, lastReplay.key, lastReplay.body).expect(201)).body,
  ).toEqual(lastReplay.response);
});
