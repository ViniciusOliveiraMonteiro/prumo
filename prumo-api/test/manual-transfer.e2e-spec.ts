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
  throw new Error('Local test database URLs are required');
const admin = new pg.Pool({ connectionString: process.env.PRUMO_DATABASE_URL });
const restricted = new pg.Pool({
  connectionString: process.env.PRUMO_APP_DATABASE_URL,
});
const users: { id: string; email: string; cookie: string }[] = [];
const houses: string[] = [];
const accounts: string[] = [];
let destination: string;
let app: INestApplication<App>;
let firstEvent: string;
const password = 'manual-transfer-test-password-long-enough';

function post(house: string, cookie: string, key: string, body: object) {
  return request(app.getHttpServer())
    .post(`/api/households/${house}/transactions/transfers`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .set('Idempotency-Key', key)
    .send(body);
}
function get(house: string, cookie: string, path: string) {
  return request(app.getHttpServer())
    .get(`/api/households/${house}/${path}`)
    .set('Cookie', cookie);
}
function body() {
  return {
    sourceAccountId: accounts[0],
    destinationAccountId: destination,
    amountCents: '30000',
    currency: 'BRL',
    sourceEffectiveDate: '2026-02-01',
    destinationEffectiveDate: '2026-02-03',
    description: 'Transferência interna',
  };
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
beforeAll(async () => {
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  for (let index = 0; index < 2; index += 1) {
    const email = `transfer-${randomUUID()}@prumo.test`;
    const user = await admin.query<{ id: string }>(
      'INSERT INTO identity.users(email,email_normalized,password_hash) VALUES ($1,$2,$3) RETURNING id',
      [email, email, hash],
    );
    users.push({ id: user.rows[0].id, email, cookie: '' });
    const house = await admin.query<{ id: string }>(
      'INSERT INTO household.households(name) VALUES ($1) RETURNING id',
      [`Transfer ${index}`],
    );
    houses.push(house.rows[0].id);
    await admin.query(
      "INSERT INTO household.memberships(household_id,user_id,role) VALUES ($1,$2,'OWNER')",
      [houses[index], users[index].id],
    );
    const account = await admin.query<{ id: string }>(
      "INSERT INTO finance.accounts(household_id,created_by_user_id,name,currency,opening_date,opening_balance_cents) VALUES ($1,$2,$3,'BRL','2026-01-31',$4) RETURNING id",
      [
        houses[index],
        users[index].id,
        `Transfer account ${index}`,
        index ? 50000 : 200000,
      ],
    );
    accounts.push(account.rows[0].id);
  }
  const sibling = await admin.query<{ id: string }>(
    "INSERT INTO finance.accounts(household_id,created_by_user_id,name,currency,opening_date,opening_balance_cents) VALUES ($1,$2,'Transfer destination','BRL','2026-01-31',50000) RETURNING id",
    [houses[0], users[0].id],
  );
  destination = sibling.rows[0].id;
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
  const client = await admin.connect();
  try {
    await client.query('BEGIN');
    for (const house of houses) {
      for (const table of [
        'transfer_requests',
        'movements',
        'event_versions',
        'events',
        'accounts',
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
  for (const user of users)
    await admin.query('DELETE FROM identity.users WHERE id = $1', [user.id]);
  await restricted.end();
  await admin.end();
});

test('confirmed pair has two signed movements, own dates and exact transit', async () => {
  const response = await post(
    houses[0],
    users[0].cookie,
    randomUUID(),
    body(),
  ).expect(201);
  firstEvent = response.body.eventId;
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toMatchObject({
    type: 'INTERNAL_TRANSFER',
    amountCents: '30000',
    sourceMovementAmountCents: '-30000',
    destinationMovementAmountCents: '30000',
    sourceDateProvenance: 'MANUAL_USER',
    destinationDateProvenance: 'MANUAL_USER',
  });
  const detail = await get(
    houses[0],
    users[0].cookie,
    `transactions/transfers/${firstEvent}`,
  ).expect(200);
  expect(detail.body).toEqual(response.body);
  const source = await get(
    houses[0],
    users[0].cookie,
    `accounts/${accounts[0]}/movements`,
  ).expect(200);
  const target = await get(
    houses[0],
    users[0].cookie,
    `accounts/${destination}/movements`,
  ).expect(200);
  expect(source.body.items).toMatchObject([
    {
      eventId: firstEvent,
      movementAmountCents: '-30000',
      effectiveDate: '2026-02-01',
      type: 'INTERNAL_TRANSFER',
    },
  ]);
  expect(target.body.items).toMatchObject([
    {
      eventId: firstEvent,
      movementAmountCents: '30000',
      effectiveDate: '2026-02-03',
      type: 'INTERNAL_TRANSFER',
    },
  ]);
  const a = await get(
    houses[0],
    users[0].cookie,
    `accounts/${accounts[0]}/balance?date=2026-02-01`,
  ).expect(200);
  const b = await get(
    houses[0],
    users[0].cookie,
    `accounts/${destination}/balance?date=2026-02-01`,
  ).expect(200);
  expect([a.body.balanceCents, b.body.balanceCents]).toEqual([
    '170000',
    '50000',
  ]);
  const transit = await get(
    houses[0],
    users[0].cookie,
    'transfers/in-transit?date=2026-02-02',
  ).expect(200);
  expect(transit.body).toMatchObject({
    totalCents: '30000',
    items: [{ eventId: firstEvent, amountCents: '30000' }],
  });
  const arrived = await get(
    houses[0],
    users[0].cookie,
    'transfers/in-transit?date=2026-02-03',
  ).expect(200);
  expect(arrived.body).toMatchObject({ totalCents: '0', items: [] });
  expect(
    (
      await get(
        houses[0],
        users[0].cookie,
        `accounts/${destination}/balance?date=2026-02-03`,
      ).expect(200)
    ).body.balanceCents,
  ).toBe('80000');
  expect(
    (
      await admin.query<{ amount: string }>(
        "SELECT COALESCE(sum(amount_cents::numeric),0)::text AS amount FROM finance.event_versions WHERE household_id=$1 AND event_type IN ('RECEIVED_INCOME','DIRECT_EXPENSE')",
        [houses[0]],
      )
    ).rows[0].amount,
  ).toBe('0');
});

test('retry is durable and different keys create distinct transfers', async () => {
  const key = randomUUID();
  const pair = await Promise.all(
    Array.from({ length: 4 }, () =>
      post(houses[0], users[0].cookie, key, body()),
    ),
  );
  pair.forEach((response) => expect(response.status).toBe(201));
  expect(new Set(pair.map((response) => response.body.eventId)).size).toBe(1);
  expect(
    (
      await post(houses[0], users[0].cookie, key, {
        ...body(),
        amountCents: '30100',
      })
    ).status,
  ).toBe(409);
  const distinct = await post(
    houses[0],
    users[0].cookie,
    randomUUID(),
    body(),
  ).expect(201);
  expect(distinct.body.eventId).not.toBe(pair[0].body.eventId);
  const count = await admin.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM finance.movements WHERE household_id=$1 AND event_id=$2',
    [houses[0], pair[0].body.eventId],
  );
  expect(count.rows[0].count).toBe('2');
  await app.close();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.init();
  const afterRestart = await post(
    houses[0],
    users[0].cookie,
    key,
    body(),
  ).expect(201);
  expect(afterRestart.body.eventId).toBe(pair[0].body.eventId);
  const page1 = await get(
    houses[0],
    users[0].cookie,
    'transfers/in-transit?date=2026-02-02&limit=1',
  ).expect(200);
  expect(page1.body).toMatchObject({ totalCents: '90000' });
  expect(page1.body.items).toHaveLength(1);
  expect(page1.body.nextCursor).toBeTruthy();
  const page2 = await get(
    houses[0],
    users[0].cookie,
    `transfers/in-transit?date=2026-02-02&limit=1&cursor=${page1.body.nextCursor}`,
  ).expect(200);
  expect(page2.body.totalCents).toBe('90000');
  expect(page2.body.items).toHaveLength(1);
  expect(page2.body.items[0].eventId).not.toBe(page1.body.items[0].eventId);
  const emptyPage = await get(
    houses[0],
    users[0].cookie,
    `transfers/in-transit?date=2026-02-02&limit=1&cursor=9999-12-31:${randomUUID()}`,
  ).expect(200);
  expect(emptyPage.body).toMatchObject({
    totalCents: '90000',
    items: [],
    nextCursor: null,
  });
});

test('same-day transfer has no transit and a valid debit may make a historical balance negative', async () => {
  const sameDay = await post(houses[0], users[0].cookie, randomUUID(), {
    ...body(),
    amountCents: '150000',
    sourceEffectiveDate: '2026-02-04',
    destinationEffectiveDate: '2026-02-04',
  }).expect(201);
  expect(sameDay.body.sourceMovementAmountCents).toBe('-150000');
  const source = await get(
    houses[0],
    users[0].cookie,
    `accounts/${accounts[0]}/balance?date=2026-02-04`,
  ).expect(200);
  expect(source.body).toMatchObject({
    balanceCents: '-40000',
    negativeBalance: true,
  });
  const transit = await get(
    houses[0],
    users[0].cookie,
    'transfers/in-transit?date=2026-02-04',
  ).expect(200);
  expect(transit.body.totalCents).toBe('0');
  const historical = await get(
    houses[0],
    users[0].cookie,
    `accounts/${accounts[0]}/balance?date=2026-02-03`,
  ).expect(200);
  expect(historical.body).toMatchObject({
    balanceCents: '110000',
    negativeBalance: false,
  });
});

test('aggregate transit and balances stay exact beyond a single entry limit', async () => {
  const large = {
    ...body(),
    amountCents: '9007199254740991',
    sourceEffectiveDate: '2026-02-05',
    destinationEffectiveDate: '2026-02-06',
  };
  await post(houses[0], users[0].cookie, randomUUID(), large).expect(201);
  await post(houses[0], users[0].cookie, randomUUID(), large).expect(201);
  const transit = await get(
    houses[0],
    users[0].cookie,
    'transfers/in-transit?date=2026-02-05',
  ).expect(200);
  expect(transit.body.totalCents).toBe('18014398509481982');
  const source = await get(
    houses[0],
    users[0].cookie,
    `accounts/${accounts[0]}/balance?date=2026-02-05`,
  ).expect(200);
  expect(source.body.balanceCents).toBe('-18014398509521982');
  const target = await get(
    houses[0],
    users[0].cookie,
    `accounts/${destination}/balance?date=2026-02-06`,
  ).expect(200);
  expect(target.body.balanceCents).toBe('18014398509771982');
});

test('invalid dates, accounts and tenant references fail without effects', async () => {
  for (const invalid of [
    { ...body(), destinationAccountId: accounts[0] },
    { ...body(), destinationEffectiveDate: '2026-01-30' },
    { ...body(), sourceEffectiveDate: '2026-01-30' },
    { ...body(), destinationEffectiveDate: '2026-02-31' },
    { ...body(), amountCents: '0' },
    { ...body(), destinationEffectiveDate: '9999-12-31' },
  ])
    await post(houses[0], users[0].cookie, randomUUID(), invalid).expect(400);
  await post(houses[0], users[0].cookie, randomUUID(), {
    ...body(),
    destinationAccountId: accounts[1],
  }).expect(404);
  await post(houses[0], users[1].cookie, randomUUID(), body()).expect(403);
  await post(houses[1], users[1].cookie, randomUUID(), body()).expect(404);
  await get(
    houses[1],
    users[1].cookie,
    `transactions/transfers/${firstEvent}`,
  ).expect(404);
  await get(
    houses[1],
    users[1].cookie,
    'transfers/in-transit?date=2026-02-02',
  ).expect(200);
});

test('database refuses a half-pair and wrong sign under the restricted role', async () => {
  const client = await restricted.connect();
  try {
    await client.query('BEGIN');
    const eventId = randomUUID();
    const sourceId = randomUUID();
    const targetId = randomUUID();
    await client.query(
      "INSERT INTO finance.events(id,household_id,type) VALUES ($1,$2,'INTERNAL_TRANSFER')",
      [eventId, houses[0]],
    );
    await client.query(
      `INSERT INTO finance.event_versions(household_id,event_id,version,movement_id,account_id,amount_cents,currency,effective_date,description,state,date_provenance,recorded_by_user_id,event_type,destination_movement_id,destination_account_id,destination_effective_date)
      VALUES ($1,$2,1,$3,$4,300,'BRL','2026-02-01','test','APPLIED','MANUAL_USER',$5,'INTERNAL_TRANSFER',$6,$7,'2026-02-03')`,
      [
        houses[0],
        eventId,
        sourceId,
        accounts[0],
        users[0].id,
        targetId,
        destination,
      ],
    );
    await client.query(
      `INSERT INTO finance.movements(id,household_id,event_id,version,account_id,amount_cents,effective_date,state,event_type,side)
      VALUES ($1,$2,$3,1,$4,-300,'2026-02-01','APPLIED','INTERNAL_TRANSFER','TRANSFER_OUT')`,
      [sourceId, houses[0], eventId, accounts[0]],
    );
    await expect(client.query('COMMIT')).rejects.toThrow();
    await client.query('ROLLBACK');
    const missing = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM finance.events WHERE household_id=$1 AND id=$2',
      [houses[0], eventId],
    );
    expect(missing.rows[0].count).toBe('0');
    await client.query('BEGIN');
    const secondId = randomUUID();
    await client.query(
      "INSERT INTO finance.events(id,household_id,type) VALUES ($1,$2,'INTERNAL_TRANSFER')",
      [secondId, houses[0]],
    );
    await client.query(
      `INSERT INTO finance.event_versions(household_id,event_id,version,movement_id,account_id,amount_cents,currency,effective_date,description,state,date_provenance,recorded_by_user_id,event_type,destination_movement_id,destination_account_id,destination_effective_date)
      VALUES ($1,$2,1,$3,$4,300,'BRL','2026-02-01','test','APPLIED','MANUAL_USER',$5,'INTERNAL_TRANSFER',$6,$7,'2026-02-03')`,
      [
        houses[0],
        secondId,
        randomUUID(),
        accounts[0],
        users[0].id,
        randomUUID(),
        destination,
      ],
    );
    await expect(
      client.query(
        `INSERT INTO finance.movements(household_id,event_id,version,account_id,amount_cents,effective_date,state,event_type,side)
      VALUES ($1,$2,1,$3,300,'2026-02-01','APPLIED','INTERNAL_TRANSFER','TRANSFER_OUT')`,
        [houses[0], secondId, accounts[0]],
      ),
    ).rejects.toThrow();
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('database rejects a destination account from another household', async () => {
  const client = await restricted.connect();
  try {
    await client.query('BEGIN');
    const eventId = randomUUID();
    await client.query(
      "INSERT INTO finance.events(id,household_id,type) VALUES ($1,$2,'INTERNAL_TRANSFER')",
      [eventId, houses[0]],
    );
    await expect(
      client.query(
        `INSERT INTO finance.event_versions(household_id,event_id,version,movement_id,account_id,amount_cents,currency,effective_date,description,state,date_provenance,recorded_by_user_id,event_type,destination_movement_id,destination_account_id,destination_effective_date)
       VALUES ($1,$2,1,$3,$4,300,'BRL','2026-02-01','test','APPLIED','MANUAL_USER',$5,'INTERNAL_TRANSFER',$6,$7,'2026-02-03')`,
        [
          houses[0],
          eventId,
          randomUUID(),
          accounts[0],
          users[0].id,
          randomUUID(),
          accounts[1],
        ],
      ),
    ).rejects.toThrow();
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('rollback after source movement leaves no event, debit or request', async () => {
  const key = randomUUID();
  const before = await admin.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM finance.events WHERE household_id=$1',
    [houses[0]],
  );
  await admin.query(`CREATE FUNCTION finance.reject_transfer_arrival_test() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.side = 'TRANSFER_IN' THEN RAISE EXCEPTION 'test transfer arrival failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_transfer_arrival_test BEFORE INSERT ON finance.movements
    FOR EACH ROW EXECUTE FUNCTION finance.reject_transfer_arrival_test();`);
  try {
    await post(houses[0], users[0].cookie, key, body()).expect(500);
    const after = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM finance.events WHERE household_id=$1',
      [houses[0]],
    );
    expect(after.rows[0].count).toBe(before.rows[0].count);
    const requests = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM finance.transfer_requests WHERE household_id=$1 AND request_key=$2',
      [houses[0], key],
    );
    expect(requests.rows[0].count).toBe('0');
  } finally {
    await admin.query(
      'DROP TRIGGER reject_transfer_arrival_test ON finance.movements; DROP FUNCTION finance.reject_transfer_arrival_test();',
    );
  }
  await post(houses[0], users[0].cookie, key, body()).expect(201);
});

test('revocation and transfer commit in the order of their membership locks', async () => {
  const blocker = await admin.connect();
  const revoker = await admin.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      'UPDATE household.memberships SET active=false WHERE household_id=$1 AND user_id=$2',
      [houses[0], users[0].id],
    );
    const rejected = post(
      houses[0],
      users[0].cookie,
      randomUUID(),
      body(),
    ).then((response) => response);
    await waitForBlocked(1);
    await blocker.query('COMMIT');
    expect((await rejected).status).toBe(404);
    await get(
      houses[0],
      users[0].cookie,
      `transactions/transfers/${firstEvent}`,
    ).expect(404);
    await get(
      houses[0],
      users[0].cookie,
      'transfers/in-transit?date=2026-02-02',
    ).expect(404);
    await admin.query(
      'UPDATE household.memberships SET active=true WHERE household_id=$1 AND user_id=$2',
      [houses[0], users[0].id],
    );

    const key = randomUUID();
    const lockName = `${houses[0]}:transfer:create:${key}`;
    await blocker.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [
      lockName,
    ]);
    const writing = post(houses[0], users[0].cookie, key, body()).then(
      (response) => response,
    );
    await waitForBlocked(1);
    await revoker.query('BEGIN');
    const revocation = revoker.query(
      'UPDATE household.memberships SET active=false WHERE household_id=$1 AND user_id=$2',
      [houses[0], users[0].id],
    );
    await waitForBlocked(2);
    await blocker.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [
      lockName,
    ]);
    expect((await writing).status).toBe(201);
    await revocation;
    await revoker.query('COMMIT');
    await post(houses[0], users[0].cookie, key, body()).expect(404);
  } finally {
    await blocker.query('SELECT pg_advisory_unlock_all()');
    await blocker.query('ROLLBACK');
    await revoker.query('ROLLBACK');
    blocker.release();
    revoker.release();
    await admin.query(
      'UPDATE household.memberships SET active=true WHERE household_id=$1 AND user_id=$2',
      [houses[0], users[0].id],
    );
  }
}, 20000);
