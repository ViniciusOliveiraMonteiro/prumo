import { randomUUID } from 'node:crypto';
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
if (!process.env.PRUMO_DATABASE_URL || !process.env.PRUMO_APP_DATABASE_URL)
  throw new Error('Local test database URLs are required');
const admin = new pg.Pool({ connectionString: process.env.PRUMO_DATABASE_URL });
const restricted = new pg.Pool({
  connectionString: process.env.PRUMO_APP_DATABASE_URL,
});
const people: { id: string; email: string; cookie: string }[] = [];
const houses: string[] = [];
const accounts: string[] = [];
let app: INestApplication<App>;
let categoryId: string;
const password = 'manual-expense-test-password-long-enough';

async function start(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const server = moduleRef.createNestApplication();
  configureHttp(server);
  await server.init();
  return server;
}
function postCategory(
  house: string,
  cookie: string,
  key: string,
  name: string,
) {
  return request(app.getHttpServer())
    .post(`/api/households/${house}/expense-categories`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .set('Idempotency-Key', key)
    .send({ name });
}
function postExpense(house: string, cookie: string, key: string, body: object) {
  return request(app.getHttpServer())
    .post(`/api/households/${house}/transactions/expenses`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .set('Idempotency-Key', key)
    .send(body);
}
function getBalance(
  house: string,
  account: string,
  cookie: string,
  date: string,
) {
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
        AND usename IN ('prumo_app', current_user) AND pid <> pg_backend_pid()`);
    if (Number(result.rows[0].count) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected ${count} blocked database sessions`);
}
const body = () => ({
  accountId: accounts[0],
  categoryId,
  amountCents: '13000',
  currency: 'BRL',
  effectiveDate: '2026-02-02',
  description: 'Compra direta',
});

beforeAll(async () => {
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  for (let i = 0; i < 2; i += 1) {
    const email = `expense-${randomUUID()}@prumo.test`;
    const person = await admin.query<{ id: string }>(
      'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$2,$3) RETURNING id',
      [email, email, hash],
    );
    people.push({ id: person.rows[0].id, email, cookie: '' });
    const house = await admin.query<{ id: string }>(
      'INSERT INTO household.households(name) VALUES ($1) RETURNING id',
      [`Expense ${i}`],
    );
    houses.push(house.rows[0].id);
    await admin.query(
      "INSERT INTO household.memberships(household_id,user_id,role) VALUES ($1,$2,'OWNER')",
      [houses[i], people[i].id],
    );
    const account = await admin.query<{ id: string }>(
      "INSERT INTO finance.accounts(household_id,created_by_user_id,name,currency,opening_date,opening_balance_cents) VALUES ($1,$2,'Expense account','BRL','2026-02-01',10000) RETURNING id",
      [houses[i], people[i].id],
    );
    accounts.push(account.rows[0].id);
  }
  await admin.query(
    "INSERT INTO household.memberships(household_id,user_id,role) VALUES ($1,$2,'VIEWER')",
    [houses[0], people[1].id],
  );
  app = await start();
  for (const person of people) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .set('Host', 'localhost:3000')
      .set('Origin', 'http://localhost:3000')
      .send({ email: person.email, password })
      .expect(200);
    const cookie = response.headers['set-cookie'];
    person.cookie = Array.isArray(cookie) ? cookie[0] : cookie;
  }
  categoryId = (
    await postCategory(
      houses[0],
      people[0].cookie,
      randomUUID(),
      'Mercado',
    ).expect(201)
  ).body.id;
});

afterAll(async () => {
  await app?.close();
  const client = await admin.connect();
  try {
    await client.query('BEGIN');
    for (const house of houses) {
      for (const table of [
        'expense_requests',
        'category_requests',
        'income_requests',
        'movements',
        'event_versions',
        'events',
        'accounts',
        'expense_categories',
      ])
        await client.query(
          `DELETE FROM finance.${table} WHERE household_id = $1`,
          [house],
        );
      await client.query(
        'DELETE FROM household.memberships WHERE household_id = $1',
        [house],
      );
      await client.query('DELETE FROM household.households WHERE id = $1', [
        house,
      ]);
    }
    await client.query('COMMIT');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  for (const person of people)
    await admin.query('DELETE FROM identity.users WHERE id = $1', [person.id]);
  await restricted.end();
  await admin.end();
});

test('category has stable household identity and durable retry', async () => {
  const key = randomUUID();
  const first = await postCategory(
    houses[0],
    people[0].cookie,
    key,
    'Farmácia',
  ).expect(201);
  const replay = await postCategory(
    houses[0],
    people[0].cookie,
    key,
    ' Farmácia ',
  ).expect(201);
  expect(replay.body).toEqual(first.body);
  await postCategory(houses[0], people[0].cookie, key, 'Outra').expect(409);
  const repeated = await postCategory(
    houses[0],
    people[0].cookie,
    randomUUID(),
    'Farmácia',
  ).expect(201);
  expect(repeated.body.id).not.toBe(first.body.id);
  const list = await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/expense-categories`)
    .set('Cookie', people[1].cookie)
    .expect(200);
  expect(list.body.map((item: { id: string }) => item.id)).toContain(
    first.body.id,
  );
  expect(list.headers['cache-control']).toBe('no-store');
  await postCategory(
    houses[0],
    people[1].cookie,
    randomUUID(),
    'Negada',
  ).expect(403);
  await request(app.getHttpServer())
    .get(`/api/households/${houses[1]}/expense-categories`)
    .set('Cookie', people[0].cookie)
    .expect(404);
});

test('expense debit changes exact daily balance and is listed with signed movement', async () => {
  const created = await postExpense(
    houses[0],
    people[0].cookie,
    randomUUID(),
    body(),
  ).expect(201);
  expect(created.body).toMatchObject({
    type: 'DIRECT_EXPENSE',
    categoryId,
    amountCents: '13000',
    movementAmountCents: '-13000',
    state: 'APPLIED',
    pendingReason: null,
  });
  expect(
    (
      await getBalance(
        houses[0],
        accounts[0],
        people[0].cookie,
        '2026-02-01',
      ).expect(200)
    ).body.balanceCents,
  ).toBe('10000');
  expect(
    (
      await getBalance(
        houses[0],
        accounts[0],
        people[0].cookie,
        '2026-02-02',
      ).expect(200)
    ).body.balanceCents,
  ).toBe('-3000');
  expect(
    (
      await getBalance(
        houses[0],
        accounts[0],
        people[0].cookie,
        '2026-02-02',
      ).expect(200)
    ).body.negativeBalance,
  ).toBe(true);
  const received = await request(app.getHttpServer())
    .post(`/api/households/${houses[0]}/transactions/income`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', people[0].cookie)
    .set('Idempotency-Key', randomUUID())
    .send({
      accountId: accounts[0],
      amountCents: '5000',
      currency: 'BRL',
      effectiveDate: '2026-02-03',
      description: 'Recebimento posterior',
    })
    .expect(201);
  expect(received.body.movementAmountCents).toBe('5000');
  const recovered = await getBalance(
    houses[0],
    accounts[0],
    people[0].cookie,
    '2026-02-03',
  ).expect(200);
  expect(recovered.body).toMatchObject({
    balanceCents: '2000',
    negativeBalance: false,
  });
  expect(
    (
      await getBalance(
        houses[1],
        accounts[1],
        people[1].cookie,
        '2026-02-02',
      ).expect(200)
    ).body.balanceCents,
  ).toBe('10000');
  const detail = await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/transactions/${created.body.eventId}`)
    .set('Cookie', people[0].cookie)
    .expect(200);
  expect(detail.body).toEqual(created.body);
  const page = await request(app.getHttpServer())
    .get(`/api/households/${houses[0]}/accounts/${accounts[0]}/movements`)
    .set('Cookie', people[0].cookie)
    .expect(200);
  expect(
    page.body.items.map((item: { eventId: string }) => item.eventId),
  ).toContain(created.body.eventId);
  const month = await admin.query<{ cents: string }>(
    "SELECT COALESCE(sum(amount_cents::numeric),0)::text AS cents FROM finance.event_versions WHERE household_id=$1 AND event_type='DIRECT_EXPENSE' AND state='APPLIED' AND effective_date >= '2026-02-01' AND effective_date < '2026-03-01'",
    [houses[0]],
  );
  expect(month.rows[0].cents).toBe('13000');
});

test('pre-opening candidate has no effect, and retries and validation preserve one event', async () => {
  const key = randomUUID();
  const pendingBody = { ...body(), effectiveDate: '2026-01-31' };
  const responses = await Promise.all(
    Array.from({ length: 6 }, () =>
      postExpense(houses[0], people[0].cookie, key, pendingBody),
    ),
  );
  expect(responses.map((response) => response.status)).toEqual(
    Array(6).fill(201),
  );
  for (const response of responses)
    expect(response.body).toEqual(responses[0].body);
  expect(responses[0].body.state).toBe('PENDING_PRE_OPENING');
  expect(
    (
      await getBalance(
        houses[0],
        accounts[0],
        people[0].cookie,
        '2026-02-02',
      ).expect(200)
    ).body.balanceCents,
  ).toBe('-3000');
  await app.close();
  app = await start();
  expect(
    (
      await postExpense(houses[0], people[0].cookie, key, pendingBody).expect(
        201,
      )
    ).body,
  ).toEqual(responses[0].body);
  await postExpense(houses[0], people[0].cookie, key, {
    ...pendingBody,
    amountCents: '13001',
  }).expect(409);
  for (const amountCents of ['0', '-1', '01', '9007199254740992'])
    await postExpense(houses[0], people[0].cookie, randomUUID(), {
      ...body(),
      amountCents,
    }).expect(400);
  await postExpense(houses[0], people[0].cookie, randomUUID(), {
    ...body(),
    effectiveDate: '2026-02-30',
  }).expect(400);
  await postExpense(houses[0], people[0].cookie, randomUUID(), {
    ...body(),
    categoryId: randomUUID(),
  }).expect(404);
  await postExpense(houses[0], people[0].cookie, randomUUID(), {
    ...body(),
    accountId: accounts[1],
  }).expect(404);
  await postExpense(houses[0], people[1].cookie, randomUUID(), body()).expect(
    403,
  );
});

test('cross-household category is rejected and failed request insert rolls back', async () => {
  const foreign = await postCategory(
    houses[1],
    people[1].cookie,
    randomUUID(),
    'Fora',
  ).expect(201);
  await postExpense(houses[0], people[0].cookie, randomUUID(), {
    ...body(),
    categoryId: foreign.body.id,
  }).expect(404);
  const key = randomUUID();
  const description = `private-expense-${randomUUID()}`;
  const count = async () =>
    (
      await admin.query<{ count: string }>(
        'SELECT count(*) FROM finance.events WHERE household_id=$1',
        [houses[0]],
      )
    ).rows[0].count;
  const before = await count();
  await admin.query(`CREATE FUNCTION finance.reject_expense_request_test() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected expense failure'; END $$;
    CREATE TRIGGER reject_expense_request_test BEFORE INSERT ON finance.expense_requests
    FOR EACH ROW EXECUTE FUNCTION finance.reject_expense_request_test();`);
  const log = vi.spyOn(Logger.prototype, 'error');
  try {
    const failed = await postExpense(houses[0], people[0].cookie, key, {
      ...body(),
      description,
    }).expect(500);
    expect(JSON.stringify(failed.body)).not.toContain(description);
    expect(JSON.stringify(log.mock.calls)).not.toContain(description);
    expect(await count()).toBe(before);
  } finally {
    log.mockRestore();
    await admin.query(
      'DROP TRIGGER reject_expense_request_test ON finance.expense_requests; DROP FUNCTION finance.reject_expense_request_test();',
    );
  }
  await postExpense(houses[0], people[0].cookie, key, {
    ...body(),
    description,
  }).expect(201);
});

test('database constraints reject wrong movement sign and wrong event type under app role', async () => {
  const client = await restricted.connect();
  try {
    await client.query('BEGIN');
    const eventId = randomUUID();
    const movementId = randomUUID();
    await client.query(
      "INSERT INTO finance.events(id,household_id,type) VALUES ($1,$2,'DIRECT_EXPENSE')",
      [eventId, houses[0]],
    );
    await client.query(
      `INSERT INTO finance.event_versions(household_id,event_id,version,movement_id,account_id,amount_cents,currency,effective_date,description,state,date_provenance,recorded_by_user_id,event_type,category_id)
      VALUES ($1,$2,1,$3,$4,100,'BRL','2026-02-02','test','APPLIED','MANUAL_USER',$5,'DIRECT_EXPENSE',$6)`,
      [houses[0], eventId, movementId, accounts[0], people[0].id, categoryId],
    );
    await expect(
      client.query(
        `INSERT INTO finance.movements(id,household_id,event_id,version,account_id,amount_cents,effective_date,state,event_type)
      VALUES ($1,$2,$3,1,$4,100,'2026-02-02','APPLIED','DIRECT_EXPENSE')`,
        [movementId, houses[0], eventId, accounts[0]],
      ),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('database rejects negative income and mismatched event type under app role', async () => {
  const client = await restricted.connect();
  try {
    await client.query('BEGIN');
    const eventId = randomUUID();
    const movementId = randomUUID();
    await client.query(
      "INSERT INTO finance.events(id,household_id,type) VALUES ($1,$2,'RECEIVED_INCOME')",
      [eventId, houses[0]],
    );
    await client.query(
      `INSERT INTO finance.event_versions(household_id,event_id,version,movement_id,account_id,amount_cents,currency,effective_date,description,state,date_provenance,recorded_by_user_id)
      VALUES ($1,$2,1,$3,$4,100,'BRL','2026-02-02','test','APPLIED','MANUAL_USER',$5)`,
      [houses[0], eventId, movementId, accounts[0], people[0].id],
    );
    await expect(
      client.query(
        `INSERT INTO finance.movements(id,household_id,event_id,version,account_id,amount_cents,effective_date,state)
      VALUES ($1,$2,$3,1,$4,-100,'2026-02-02','APPLIED')`,
        [movementId, houses[0], eventId, accounts[0]],
      ),
    ).rejects.toThrow();
    await client.query('ROLLBACK');

    await client.query('BEGIN');
    const mismatchedEvent = randomUUID();
    await client.query(
      "INSERT INTO finance.events(id,household_id,type) VALUES ($1,$2,'RECEIVED_INCOME')",
      [mismatchedEvent, houses[0]],
    );
    await expect(
      client.query(
        `INSERT INTO finance.event_versions(household_id,event_id,version,movement_id,account_id,amount_cents,currency,effective_date,description,state,date_provenance,recorded_by_user_id,event_type,category_id)
      VALUES ($1,$2,1,$3,$4,100,'BRL','2026-02-02','test','APPLIED','MANUAL_USER',$5,'DIRECT_EXPENSE',$6)`,
        [
          houses[0],
          mismatchedEvent,
          randomUUID(),
          accounts[0],
          people[0].id,
          categoryId,
        ],
      ),
    ).rejects.toThrow();
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('request identities cannot point to an event of the other type', async () => {
  const expense = await admin.query<{ id: string }>(
    "SELECT id FROM finance.events WHERE household_id=$1 AND type='DIRECT_EXPENSE' LIMIT 1",
    [houses[0]],
  );
  const income = await admin.query<{ id: string }>(
    "SELECT id FROM finance.events WHERE household_id=$1 AND type='RECEIVED_INCOME' LIMIT 1",
    [houses[0]],
  );
  expect(expense.rows[0]).toBeDefined();
  expect(income.rows[0]).toBeDefined();
  await expect(
    restricted.query(
      `INSERT INTO finance.income_requests(household_id,operation,request_key,actor_user_id,request_payload,event_id,response)
       VALUES ($1,'income:create',$2,$3,'{}',$4,'{}')`,
      [houses[0], randomUUID(), people[0].id, expense.rows[0].id],
    ),
  ).rejects.toThrow();
  await expect(
    restricted.query(
      `INSERT INTO finance.expense_requests(household_id,request_key,actor_user_id,request_payload,event_id,response)
       VALUES ($1,$2,$3,'{}',$4,'{}')`,
      [houses[0], randomUUID(), people[0].id, income.rows[0].id],
    ),
  ).rejects.toThrow();
});

test('a purchase in May debited in June changes only the June account and expense month', async () => {
  const may = await getBalance(
    houses[0],
    accounts[0],
    people[0].cookie,
    '2026-05-31',
  ).expect(200);
  const june = await getBalance(
    houses[0],
    accounts[0],
    people[0].cookie,
    '2026-06-01',
  ).expect(200);
  const created = await postExpense(houses[0], people[0].cookie, randomUUID(), {
    ...body(),
    amountCents: '8000',
    effectiveDate: '2026-06-01',
    description: 'Compra em 31/05, débito em 01/06',
  }).expect(201);
  const afterMay = await getBalance(
    houses[0],
    accounts[0],
    people[0].cookie,
    '2026-05-31',
  ).expect(200);
  const afterJune = await getBalance(
    houses[0],
    accounts[0],
    people[0].cookie,
    '2026-06-01',
  ).expect(200);
  expect(afterMay.body.balanceCents).toBe(may.body.balanceCents);
  expect(BigInt(afterJune.body.balanceCents)).toBe(
    BigInt(june.body.balanceCents) - 8000n,
  );
  const month = await admin.query<{ month: string }>(
    'SELECT to_char(effective_date, $1) AS month FROM finance.event_versions WHERE household_id=$2 AND event_id=$3',
    ['YYYY-MM', houses[0], created.body.eventId],
  );
  expect(month.rows[0].month).toBe('2026-06');
});

test('distinct requests remain distinct and daily aggregate stays exact above one-entry limit', async () => {
  const before = await getBalance(
    houses[0],
    accounts[0],
    people[0].cookie,
    '2026-02-04',
  ).expect(200);
  const maximum = '9007199254740991';
  const large = {
    ...body(),
    amountCents: maximum,
    effectiveDate: '2026-02-04',
  };
  const first = await postExpense(
    houses[0],
    people[0].cookie,
    randomUUID(),
    large,
  ).expect(201);
  const second = await postExpense(
    houses[0],
    people[0].cookie,
    randomUUID(),
    large,
  ).expect(201);
  expect(first.body.eventId).not.toBe(second.body.eventId);
  expect(first.body.movementId).not.toBe(second.body.movementId);
  const after = await getBalance(
    houses[0],
    accounts[0],
    people[0].cookie,
    '2026-02-04',
  ).expect(200);
  expect(after.body.balanceCents).toBe(
    (BigInt(before.body.balanceCents) - 2n * BigInt(maximum)).toString(),
  );
});

test('revocation committed first blocks expense, while a write holding membership commits first', async () => {
  const blocker = await admin.connect();
  const revoker = await admin.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      'UPDATE household.memberships SET active=false WHERE household_id=$1 AND user_id=$2',
      [houses[0], people[0].id],
    );
    const rejected = postExpense(
      houses[0],
      people[0].cookie,
      randomUUID(),
      body(),
    ).then((response) => response);
    await waitForBlocked(1);
    await blocker.query('COMMIT');
    expect((await rejected).status).toBe(404);
    await admin.query(
      'UPDATE household.memberships SET active=true WHERE household_id=$1 AND user_id=$2',
      [houses[0], people[0].id],
    );

    const key = randomUUID();
    const lockName = `${houses[0]}:expense:create:${key}`;
    await blocker.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [
      lockName,
    ]);
    const writing = postExpense(houses[0], people[0].cookie, key, body()).then(
      (response) => response,
    );
    await waitForBlocked(1);
    await revoker.query('BEGIN');
    const revocation = revoker.query(
      'UPDATE household.memberships SET active=false WHERE household_id=$1 AND user_id=$2',
      [houses[0], people[0].id],
    );
    await waitForBlocked(2);
    await blocker.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [
      lockName,
    ]);
    expect((await writing).status).toBe(201);
    await revocation;
    await revoker.query('COMMIT');
    await postExpense(houses[0], people[0].cookie, key, body()).expect(404);
    await admin.query(
      'UPDATE household.memberships SET active=true WHERE household_id=$1 AND user_id=$2',
      [houses[0], people[0].id],
    );
  } finally {
    await blocker.query('SELECT pg_advisory_unlock_all()');
    await blocker.query('ROLLBACK');
    await revoker.query('ROLLBACK');
    blocker.release();
    revoker.release();
  }
}, 20000);
