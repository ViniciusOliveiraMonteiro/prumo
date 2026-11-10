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
let app: INestApplication<App>;
let userId: string;
let house: string;
let accountA: string;
let accountB: string;
let category: string;
let cookie: string;
const email = `opening-date-${randomUUID()}@prumo.test`;
const password = 'opening-date-test-password-long-enough';

function post(path: string, body: object, key = randomUUID()) {
  return request(app.getHttpServer())
    .post(path)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .set('Idempotency-Key', key)
    .send(body);
}
function get(path: string) {
  return request(app.getHttpServer()).get(path).set('Cookie', cookie);
}
function revise(
  account: string,
  version: number,
  day: string,
  cents: string,
  key = randomUUID(),
) {
  return post(
    `/api/households/${house}/accounts/${account}/opening-balance-revisions`,
    {
      expectedVersion: version,
      openingDate: day,
      openingBalanceCents: cents,
      reason: 'Correção documentada do marco',
    },
    key,
  );
}
function balance(account: string, day: string) {
  return get(
    `/api/households/${house}/accounts/${account}/balance?date=${day}`,
  );
}

beforeAll(async () => {
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  userId = (
    await admin.query<{ id: string }>(
      'INSERT INTO identity.users(email,email_normalized,password_hash) VALUES ($1,$1,$2) RETURNING id',
      [email, hash],
    )
  ).rows[0].id;
  house = (
    await admin.query<{ id: string }>(
      "INSERT INTO household.households(name) VALUES ('Opening date E2E') RETURNING id",
    )
  ).rows[0].id;
  await admin.query(
    "INSERT INTO household.memberships(household_id,user_id,role) VALUES ($1,$2,'OWNER')",
    [house, userId],
  );
  accountA = (
    await admin.query<{ id: string }>(
      "INSERT INTO finance.accounts(household_id,created_by_user_id,name,currency,opening_date,opening_balance_cents) VALUES ($1,$2,'A','BRL','2026-02-01',500000) RETURNING id",
      [house, userId],
    )
  ).rows[0].id;
  accountB = (
    await admin.query<{ id: string }>(
      "INSERT INTO finance.accounts(household_id,created_by_user_id,name,currency,opening_date,opening_balance_cents) VALUES ($1,$2,'B','BRL','2026-01-31',100000) RETURNING id",
      [house, userId],
    )
  ).rows[0].id;
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.init();
  const signIn = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password })
    .expect(200);
  const setCookie = signIn.headers['set-cookie'];
  cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  category = (
    await post(`/api/households/${house}/expense-categories`, {
      name: 'Casa',
    }).expect(201)
  ).body.id;
});

afterAll(async () => {
  await app?.close();
  const cleanup = await admin.connect();
  try {
    await cleanup.query('BEGIN');
    for (const table of [
      'finance.movement_opening_transitions',
      'finance.opening_balance_revision_requests',
      'finance.opening_balance_revisions',
      'finance.transfer_requests',
      'finance.income_requests',
      'finance.expense_requests',
      'finance.category_requests',
      'finance.movements',
      'finance.event_versions',
      'finance.events',
      'finance.expense_categories',
      'finance.account_requests',
      'finance.accounts',
    ])
      await cleanup.query(`DELETE FROM ${table} WHERE household_id = $1`, [
        house,
      ]);
    await cleanup.query(
      'DELETE FROM household.memberships WHERE household_id = $1',
      [house],
    );
    await cleanup.query('DELETE FROM household.households WHERE id = $1', [
      house,
    ]);
    await cleanup.query('DELETE FROM identity.sessions WHERE user_id = $1', [
      userId,
    ]);
    await cleanup.query('DELETE FROM identity.users WHERE id = $1', [userId]);
    await cleanup.query('COMMIT');
  } finally {
    await cleanup.query('ROLLBACK');
    cleanup.release();
    await admin.end();
    await restricted.end();
  }
});

test('advancing and retreating the opening day changes inclusion without duplicating events', async () => {
  const income = await post(`/api/households/${house}/transactions/income`, {
    accountId: accountA,
    amountCents: '20000',
    currency: 'BRL',
    effectiveDate: '2026-02-02',
    description: 'Entrada',
  }).expect(201);
  const expense = await post(`/api/households/${house}/transactions/expenses`, {
    accountId: accountA,
    categoryId: category,
    amountCents: '8000',
    currency: 'BRL',
    effectiveDate: '2026-02-04',
    description: 'Saída',
  }).expect(201);
  expect(
    (await balance(accountA, '2026-02-04').expect(200)).body.balanceCents,
  ).toBe('512000');
  const moved = await revise(accountA, 1, '2026-02-03', '520000').expect(201);
  expect(moved.body).toMatchObject({
    previousOpeningDate: '2026-02-01',
    openingDate: '2026-02-03',
  });
  expect(
    (await balance(accountA, '2026-02-04').expect(200)).body.balanceCents,
  ).toBe('512000');
  expect(
    (await balance(accountA, '2026-02-02').expect(200)).body.calculable,
  ).toBe(false);
  expect(
    (
      await get(
        `/api/households/${house}/transactions/${income.body.eventId}`,
      ).expect(200)
    ).body.state,
  ).toBe('PENDING_PRE_OPENING');
  expect(
    (
      await get(
        `/api/households/${house}/transactions/${expense.body.eventId}`,
      ).expect(200)
    ).body.state,
  ).toBe('APPLIED');
  await revise(accountA, 2, '2026-02-01', '500000').expect(201);
  expect(
    (
      await get(
        `/api/households/${house}/transactions/${income.body.eventId}`,
      ).expect(200)
    ).body.state,
  ).toBe('APPLIED');
  expect(
    (await balance(accountA, '2026-02-04').expect(200)).body.balanceCents,
  ).toBe('512000');
  const history = await get(
    `/api/households/${house}/accounts/${accountA}/opening-balance-revisions`,
  ).expect(200);
  expect(
    history.body.items.map((item: { openingDate: string }) => item.openingDate),
  ).toEqual(['2026-02-01', '2026-02-03', '2026-02-01']);
  const transitions = await restricted.query<{
    previous_state: string;
    state: string;
  }>(
    'SELECT previous_state, state FROM finance.movement_opening_transitions WHERE household_id = $1 AND movement_id = $2 ORDER BY recorded_at',
    [house, income.body.movementId],
  );
  expect(transitions.rows).toEqual([
    { previous_state: 'APPLIED', state: 'PENDING_PRE_OPENING' },
    { previous_state: 'PENDING_PRE_OPENING', state: 'APPLIED' },
  ]);
});

test('confirmed transfer retains both movements when either opening day crosses one side', async () => {
  const body = {
    sourceAccountId: accountA,
    destinationAccountId: accountB,
    amountCents: '30000',
    currency: 'BRL',
    sourceEffectiveDate: '2026-02-01',
    destinationEffectiveDate: '2026-02-03',
    description: 'Entre contas',
  };
  const key = randomUUID();
  const created = await post(
    `/api/households/${house}/transactions/transfers`,
    body,
    key,
  ).expect(201);
  await revise(accountA, 3, '2026-02-02', '470000').expect(201);
  const sourcePending = await get(
    `/api/households/${house}/transactions/transfers/${created.body.eventId}`,
  ).expect(200);
  expect(sourcePending.body).toMatchObject({
    sourceState: 'PENDING_PRE_OPENING',
    destinationState: 'APPLIED',
    sourceOpeningDate: '2026-02-02',
    destinationOpeningDate: '2026-01-31',
  });
  const sourceList = await get(
    `/api/households/${house}/accounts/${accountA}/movements`,
  ).expect(200);
  const sourceMovement = sourceList.body.items.find(
    (item: { eventId: string }) => item.eventId === created.body.eventId,
  );
  expect(sourceMovement).toMatchObject({
    movementId: created.body.sourceMovementId,
    state: 'PENDING_PRE_OPENING',
  });
  const destinationList = await get(
    `/api/households/${house}/accounts/${accountB}/movements`,
  ).expect(200);
  const destinationMovement = destinationList.body.items.find(
    (item: { eventId: string }) => item.eventId === created.body.eventId,
  );
  expect(destinationMovement).toMatchObject({
    movementId: created.body.destinationMovementId,
    state: 'APPLIED',
  });
  expect(
    (await balance(accountA, '2026-02-03').expect(200)).body.balanceCents,
  ).toBe('490000');
  const transit = await get(
    `/api/households/${house}/transfers/in-transit?date=2026-02-02`,
  ).expect(200);
  expect(transit.body).toMatchObject({
    totalCents: '30000',
    hasPendingTransferSide: true,
  });
  expect(
    (
      await post(
        `/api/households/${house}/transactions/transfers`,
        body,
        key,
      ).expect(201)
    ).body,
  ).toEqual(created.body);
  await revise(accountA, 4, '2026-02-01', '500000').expect(201);
  await revise(accountB, 1, '2026-02-04', '130000').expect(201);
  const destinationPending = await get(
    `/api/households/${house}/transactions/transfers/${created.body.eventId}`,
  ).expect(200);
  expect(destinationPending.body).toMatchObject({
    sourceState: 'APPLIED',
    destinationState: 'PENDING_PRE_OPENING',
    sourceOpeningDate: '2026-02-01',
    destinationOpeningDate: '2026-02-04',
  });
  expect(
    (
      await get(
        `/api/households/${house}/transfers/in-transit?date=2026-02-04`,
      ).expect(200)
    ).body,
  ).toMatchObject({ totalCents: '0', hasPendingTransferSide: true });
  expect(
    (await balance(accountB, '2026-02-04').expect(200)).body.balanceCents,
  ).toBe('130000');
});

test('restricted role cannot bypass audit or leave movement state inconsistent', async () => {
  await expect(
    restricted.query(
      "UPDATE finance.accounts SET opening_date = '2026-02-05' WHERE id = $1",
      [accountA],
    ),
  ).rejects.toThrow();
  await expect(
    restricted.query(
      "UPDATE finance.movements SET state = 'PENDING_PRE_OPENING' WHERE household_id = $1 AND account_id = $2 AND state = 'APPLIED'",
      [house, accountA],
    ),
  ).rejects.toThrow();
  const facts = await admin.query<{
    revision_id: string;
    movement_id: string;
    event_id: string;
  }>(
    `
    SELECT r.id AS revision_id, m.id AS movement_id, m.event_id
    FROM finance.opening_balance_revisions r
    JOIN finance.movements m ON m.household_id = r.household_id
      AND m.account_id = r.account_id AND m.event_type = 'RECEIVED_INCOME'
    WHERE r.household_id = $1 AND r.account_id = $2 AND r.version = 5
    ORDER BY m.sequence LIMIT 1`,
    [house, accountA],
  );
  const fact = facts.rows[0];
  await expect(
    restricted.query(
      `
    INSERT INTO finance.movement_opening_transitions
      (household_id, account_id, movement_id, movement_version, event_id,
       revision_id, previous_state, state)
    VALUES ($1,$2,$3,1,$4,$5,'APPLIED','PENDING_PRE_OPENING')`,
      [house, accountA, fact.movement_id, fact.event_id, fact.revision_id],
    ),
  ).rejects.toThrow();
  const invalid = await revise(accountA, 5, '2026-02-30', '500000');
  expect(invalid.status).toBe(400);
});

test('concurrent opening revision and income creation settle on the same opening date', async () => {
  const body = {
    accountId: accountA,
    amountCents: '1000',
    currency: 'BRL',
    effectiveDate: '2026-02-02',
    description: 'Entrada concorrente',
  };
  const key = randomUUID();
  const [revision, income] = await Promise.all([
    revise(accountA, 5, '2026-02-03', '510000'),
    post(`/api/households/${house}/transactions/income`, body, key),
  ]);
  expect(revision.status).toBe(201);
  expect(income.status).toBe(201);
  const current = await get(
    `/api/households/${house}/transactions/${income.body.eventId}`,
  ).expect(200);
  expect(current.body.state).toBe('PENDING_PRE_OPENING');
  expect(
    (await balance(accountA, '2026-02-03').expect(200)).body.balanceCents,
  ).toBe('510000');
  expect(
    (
      await post(
        `/api/households/${house}/transactions/income`,
        body,
        key,
      ).expect(201)
    ).body,
  ).toEqual(income.body);
});

test('failed promotion rolls back the entire revision, then a replay preserves its original response', async () => {
  const pending = await post(`/api/households/${house}/transactions/income`, {
    accountId: accountA,
    amountCents: '700',
    currency: 'BRL',
    effectiveDate: '2026-02-02',
    description: 'Criada pendente',
  }).expect(201);
  expect(pending.body.state).toBe('PENDING_PRE_OPENING');
  const before = (
    await get(`/api/households/${house}/accounts/${accountA}`).expect(200)
  ).body;
  const count = async () =>
    Number(
      (
        await restricted.query<{ n: string }>(
          'SELECT count(*)::text AS n FROM finance.movement_opening_transitions WHERE household_id = $1 AND account_id = $2',
          [house, accountA],
        )
      ).rows[0].n,
    );
  const transitionCount = await count();
  const key = randomUUID();
  await admin.query(
    `CREATE FUNCTION finance.reject_date_revision_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected request failure'; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER reject_date_revision_test BEFORE INSERT ON finance.opening_balance_revision_requests FOR EACH ROW EXECUTE FUNCTION finance.reject_date_revision_test()',
  );
  try {
    expect(
      (await revise(accountA, 6, '2026-02-01', '500000', key)).status,
    ).toBe(500);
  } finally {
    await admin.query(
      'DROP TRIGGER reject_date_revision_test ON finance.opening_balance_revision_requests',
    );
    await admin.query('DROP FUNCTION finance.reject_date_revision_test()');
  }
  const after = (
    await get(`/api/households/${house}/accounts/${accountA}`).expect(200)
  ).body;
  expect(after).toMatchObject({
    openingVersion: before.openingVersion,
    openingDate: before.openingDate,
    openingBalanceCents: before.openingBalanceCents,
  });
  expect(await count()).toBe(transitionCount);
  expect(
    (
      await get(
        `/api/households/${house}/transactions/${pending.body.eventId}`,
      ).expect(200)
    ).body.state,
  ).toBe('PENDING_PRE_OPENING');
  const promoted = await revise(
    accountA,
    6,
    '2026-02-01',
    '500000',
    key,
  ).expect(201);
  expect(
    (
      await get(
        `/api/households/${house}/transactions/${pending.body.eventId}`,
      ).expect(200)
    ).body.state,
  ).toBe('APPLIED');
  expect(await count()).toBeGreaterThan(transitionCount);
  await revise(accountA, 7, '2026-02-03', '510000').expect(201);
  expect(
    (await revise(accountA, 6, '2026-02-01', '500000', key).expect(201)).body,
  ).toEqual(promoted.body);
});

test('an account without movements keeps its original opening date across date and value revisions', async () => {
  const emptyAccount = (
    await admin.query<{ id: string }>(
      "INSERT INTO finance.accounts(household_id,created_by_user_id,name,currency,opening_date,opening_balance_cents) VALUES ($1,$2,'Sem movimentos','BRL','2026-03-10',1000) RETURNING id",
      [house, userId],
    )
  ).rows[0].id;
  await revise(emptyAccount, 1, '2026-03-01', '2000').expect(201);
  const valueOnly = await post(
    `/api/households/${house}/accounts/${emptyAccount}/opening-balance-revisions`,
    {
      expectedVersion: 2,
      openingBalanceCents: '3000',
      reason: 'Valor corrigido na mesma data',
    },
  ).expect(201);
  expect(valueOnly.body).toMatchObject({
    previousOpeningDate: '2026-03-01',
    openingDate: '2026-03-01',
  });
  const history = await get(
    `/api/households/${house}/accounts/${emptyAccount}/opening-balance-revisions`,
  ).expect(200);
  expect(
    history.body.items.map((item: { openingDate: string }) => item.openingDate),
  ).toEqual(['2026-03-10', '2026-03-01', '2026-03-01']);
});

test('simultaneous revisions of both transfer accounts preserve each side independently', async () => {
  const [source, destination] = await Promise.all([
    revise(accountA, 8, '2026-02-05', '510000'),
    revise(accountB, 2, '2026-02-05', '130000'),
  ]);
  expect(source.status).toBe(201);
  expect(destination.status).toBe(201);
  const states = await restricted.query<{
    source_state: string;
    destination_state: string;
  }>(
    `SELECT src.state AS source_state, dst.state AS destination_state
     FROM finance.events e JOIN finance.event_versions v
       ON (v.household_id,v.event_id,v.version)=(e.household_id,e.id,e.current_version)
     JOIN finance.movements src ON (src.household_id,src.id,src.version)=(v.household_id,v.movement_id,v.version)
     JOIN finance.movements dst ON (dst.household_id,dst.id,dst.version)=(v.household_id,v.destination_movement_id,v.version)
     WHERE e.household_id=$1 AND e.type='INTERNAL_TRANSFER'`,
    [house],
  );
  expect(states.rows).toEqual([
    {
      source_state: 'PENDING_PRE_OPENING',
      destination_state: 'PENDING_PRE_OPENING',
    },
  ]);
});

test('expense creation concurrent with a date revision uses the final opening day', async () => {
  const [revision, expense] = await Promise.all([
    revise(accountA, 9, '2026-02-06', '510000'),
    post(`/api/households/${house}/transactions/expenses`, {
      accountId: accountA,
      categoryId: category,
      amountCents: '900',
      currency: 'BRL',
      effectiveDate: '2026-02-05',
      description: 'Despesa concorrente',
    }),
  ]);
  expect(revision.status).toBe(201);
  expect(expense.status).toBe(201);
  expect(
    (
      await get(
        `/api/households/${house}/transactions/${expense.body.eventId}`,
      ).expect(200)
    ).body.state,
  ).toBe('PENDING_PRE_OPENING');
});

test('transfer creation concurrent with a revision cannot persist an invalid applied side', async () => {
  const [revision, transfer] = await Promise.all([
    revise(accountA, 10, '2026-02-07', '510000'),
    post(`/api/households/${house}/transactions/transfers`, {
      sourceAccountId: accountA,
      destinationAccountId: accountB,
      amountCents: '1000',
      currency: 'BRL',
      sourceEffectiveDate: '2026-02-06',
      destinationEffectiveDate: '2026-02-06',
      description: 'Transferência concorrente',
    }),
  ]);
  expect(revision.status).toBe(201);
  expect([201, 400]).toContain(transfer.status);
  if (transfer.status === 201) {
    const detail = await get(
      `/api/households/${house}/transactions/transfers/${transfer.body.eventId}`,
    ).expect(200);
    expect(detail.body).toMatchObject({
      sourceState: 'PENDING_PRE_OPENING',
      destinationState: 'APPLIED',
    });
  }
});
