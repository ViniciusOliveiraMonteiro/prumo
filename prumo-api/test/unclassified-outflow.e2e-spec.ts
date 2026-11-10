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
let app: INestApplication<App>;
const password = 'unclassified-outflow-test-password-long-enough';
type Fixture = { house: string; source: string; destination: string };
const root = 'transactions/unclassified-outflows';
async function start() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.init();
}
function post(f: Fixture, path: string, key: string, body: object, actor = 0) {
  return request(app.getHttpServer())
    .post(`/api/households/${f.house}/${path}`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[actor].cookie)
    .set('Idempotency-Key', key)
    .send(body);
}
function get(f: Fixture, path: string, actor = 0) {
  return request(app.getHttpServer())
    .get(`/api/households/${f.house}/${path}`)
    .set('Cookie', users[actor].cookie);
}
function outflow(f: Fixture, amountCents = '30000') {
  return {
    sourceAccountId: f.source,
    amountCents,
    currency: 'BRL',
    sourceEffectiveDate: '2026-02-01',
    description: 'Débito comprovado em revisão',
  };
}
function arrival(f: Fixture) {
  return {
    expectedVersion: 1,
    destinationAccountId: f.destination,
    destinationEffectiveDate: '2026-02-03',
    reason: 'Chegada comprovada e correspondente à saída',
  };
}
async function fixture(
  sourceOpening = '2026-01-31',
  destinationOpening = sourceOpening,
): Promise<Fixture> {
  const house = await admin.query<{ id: string }>(
    'INSERT INTO household.households(name) VALUES ($1) RETURNING id',
    [`Outflow ${randomUUID()}`],
  );
  const id = house.rows[0].id;
  houses.push(id);
  for (const [actor, role] of [
    [0, 'OWNER'],
    [1, 'VIEWER'],
  ] as const)
    await admin.query(
      'INSERT INTO household.memberships(household_id,user_id,role) VALUES ($1,$2,$3)',
      [id, users[actor].id, role],
    );
  const ids: string[] = [];
  for (const [name, day, balance] of [
    ['Origem', sourceOpening, '200000'],
    ['Destino', destinationOpening, '50000'],
  ]) {
    const account = await admin.query<{ id: string }>(
      "INSERT INTO finance.accounts(household_id,created_by_user_id,name,currency,opening_date,opening_balance_cents) VALUES ($1,$2,$3,'BRL',$4::date,$5::bigint) RETURNING id",
      [id, users[0].id, name, day, balance],
    );
    ids.push(account.rows[0].id);
  }
  return { house: id, source: ids[0], destination: ids[1] };
}
async function revise(
  f: Fixture,
  account: string,
  expectedVersion: number,
  openingDate: string,
) {
  return post(
    f,
    `accounts/${account}/opening-balance-revisions`,
    randomUUID(),
    {
      expectedVersion,
      openingDate,
      openingBalanceCents: account === f.source ? '200000' : '50000',
      reason: 'Correção do marco com evidência',
    },
  ).expect(201);
}
async function waitForBlocked(count: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND usename IN ('prumo_app',current_user) AND pid<>pg_backend_pid()",
    );
    if (Number(result.rows[0].count) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected ${count} blocked database sessions`);
}
beforeAll(async () => {
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  for (let index = 0; index < 3; index++) {
    const email = `outflow-${randomUUID()}@prumo.test`;
    const user = await admin.query<{ id: string }>(
      'INSERT INTO identity.users(email,email_normalized,password_hash) VALUES ($1,$1,$2) RETURNING id',
      [email, hash],
    );
    users.push({ id: user.rows[0].id, email, cookie: '' });
  }
  await start();
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
afterAll(async () => {
  await app?.close();
  const client = await admin.connect();
  try {
    await client.query('BEGIN');
    for (const house of houses) {
      for (const table of [
        'outflow_requests',
        'arrival_links',
        'opening_balance_revision_requests',
        'movement_opening_transitions',
        'opening_balance_revisions',
        'movements',
        'event_versions',
        'events',
        'accounts',
      ])
        await client.query(
          `DELETE FROM finance.${table} WHERE household_id=$1`,
          [house],
        );
      await client.query(
        'DELETE FROM household.memberships WHERE household_id=$1',
        [house],
      );
      await client.query('DELETE FROM household.households WHERE id=$1', [
        house,
      ]);
    }
    await client.query('COMMIT');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  for (const user of users)
    await admin.query('DELETE FROM identity.users WHERE id=$1', [user.id]);
  await restricted.end();
  await admin.end();
});

test('one proven debit reduces the source and stays economically unclassified until an atomic arrival', async () => {
  const f = await fixture();
  const created = await post(f, root, randomUUID(), outflow(f)).expect(201);
  expect(created.headers['cache-control']).toBe('no-store');
  expect(created.body).toMatchObject({
    version: 1,
    type: 'UNCLASSIFIED_OUTFLOW',
    amountCents: '30000',
    sourceMovementAmountCents: '-30000',
    sourceState: 'APPLIED',
    sourceDateProvenance: 'MANUAL_USER',
    destinationAccountId: null,
    resolution: null,
  });
  const event = created.body.eventId;
  expect(
    (await get(f, `accounts/${f.source}/balance?date=2026-02-01`).expect(200))
      .body.balanceCents,
  ).toBe('170000');
  expect(
    (
      await get(f, `accounts/${f.destination}/balance?date=2026-02-03`).expect(
        200,
      )
    ).body.balanceCents,
  ).toBe('50000');
  expect(
    (await get(f, 'transfers/in-transit?date=2026-02-02').expect(200)).body,
  ).toMatchObject({ totalCents: '0', items: [] });
  expect(
    (await get(f, `${root}?date=2026-02-02`).expect(200)).body,
  ).toMatchObject({
    reviewOutflowCents: '30000',
    hasUnclassifiedOutflow: true,
    items: [{ eventId: event }],
  });
  const before = await admin.query(
    'SELECT sequence::text FROM finance.movements WHERE household_id=$1 AND event_id=$2',
    [f.house, event],
  );
  const linked = await post(
    f,
    `${root}/${event}/arrival-links`,
    randomUUID(),
    arrival(f),
  ).expect(201);
  expect(linked.body).toMatchObject({
    eventId: event,
    version: 2,
    type: 'INTERNAL_TRANSFER',
    sourceMovementId: created.body.sourceMovementId,
    recordedAt: created.body.recordedAt,
    recordedByUserId: users[0].id,
    amountCents: '30000',
    sourceMovementAmountCents: '-30000',
    destinationMovementAmountCents: '30000',
    resolution: {
      actorUserId: users[0].id,
      reason: arrival(f).reason,
      previousVersion: 1,
    },
  });
  const history = await admin.query(
    'SELECT version,sequence::text FROM finance.movements WHERE household_id=$1 AND id=$2 ORDER BY version',
    [f.house, created.body.sourceMovementId],
  );
  expect(history.rows).toEqual([
    { version: 1, sequence: before.rows[0].sequence },
    { version: 2, sequence: before.rows[0].sequence },
  ]);
  expect((await get(f, `${root}/${event}`).expect(200)).body).toEqual(
    linked.body,
  );
  expect(
    (await get(f, `transactions/transfers/${event}`).expect(200)).body,
  ).toMatchObject({ eventId: event, version: 2 });
  const movementPage = await get(f, `accounts/${f.source}/movements`).expect(
    200,
  );
  expect(movementPage.body.items).toHaveLength(1);
  expect(movementPage.body.items[0]).toMatchObject({
    eventId: event,
    version: 2,
    movementId: created.body.sourceMovementId,
  });
  expect(
    (await get(f, `accounts/${f.source}/balance?date=2026-02-03`).expect(200))
      .body.balanceCents,
  ).toBe('170000');
  expect(
    (
      await get(f, `accounts/${f.destination}/balance?date=2026-02-03`).expect(
        200,
      )
    ).body.balanceCents,
  ).toBe('80000');
  for (const date of ['2026-02-01', '2026-02-02'])
    expect(
      (await get(f, `transfers/in-transit?date=${date}`).expect(200)).body
        .totalCents,
    ).toBe('30000');
  expect(
    (await get(f, 'transfers/in-transit?date=2026-02-03').expect(200)).body
      .totalCents,
  ).toBe('0');
  expect(
    (await get(f, `${root}?date=2026-02-03`).expect(200)).body,
  ).toMatchObject({
    reviewOutflowCents: '0',
    hasUnclassifiedOutflow: false,
    items: [],
  });
  const economic = await admin.query(
    "SELECT count(*)::text AS count FROM finance.event_versions WHERE household_id=$1 AND event_type IN ('RECEIVED_INCOME','DIRECT_EXPENSE')",
    [f.house],
  );
  expect(economic.rows[0].count).toBe('0');
});

test('opening exclusions remain independent and historical versions do not block later opening revisions', async () => {
  const f = await fixture('2026-02-02', '2026-02-04');
  const created = await post(f, root, randomUUID(), outflow(f)).expect(201);
  expect(created.body.sourceState).toBe('PENDING_PRE_OPENING');
  const linked = await post(
    f,
    `${root}/${created.body.eventId}/arrival-links`,
    randomUUID(),
    arrival(f),
  ).expect(201);
  expect(linked.body).toMatchObject({
    version: 2,
    type: 'INTERNAL_TRANSFER',
    sourceState: 'PENDING_PRE_OPENING',
    destinationState: 'PENDING_PRE_OPENING',
  });
  expect(
    (await get(f, `accounts/${f.source}/balance?date=2026-02-04`).expect(200))
      .body.balanceCents,
  ).toBe('200000');
  expect(
    (
      await get(f, `accounts/${f.destination}/balance?date=2026-02-04`).expect(
        200,
      )
    ).body.balanceCents,
  ).toBe('50000');
  expect(
    (await get(f, 'transfers/in-transit?date=2026-02-02').expect(200)).body,
  ).toMatchObject({ totalCents: '30000', hasPendingTransferSide: true });
  await revise(f, f.source, 1, '2026-01-31');
  await revise(f, f.destination, 1, '2026-01-31');
  expect(
    (await get(f, `accounts/${f.source}/balance?date=2026-02-04`).expect(200))
      .body.balanceCents,
  ).toBe('170000');
  expect(
    (
      await get(f, `accounts/${f.destination}/balance?date=2026-02-04`).expect(
        200,
      )
    ).body.balanceCents,
  ).toBe('80000');
  await revise(f, f.source, 2, '2026-02-02');
  await revise(f, f.destination, 2, '2026-02-04');
  const historical = await admin.query(
    'SELECT state FROM finance.movements WHERE household_id=$1 AND event_id=$2 AND version=1',
    [f.house, created.body.eventId],
  );
  expect(historical.rows).toEqual([{ state: 'PENDING_PRE_OPENING' }]);
  const transitions = await admin.query(
    'SELECT count(*)::text AS count FROM finance.movement_opening_transitions WHERE household_id=$1 AND movement_version=2',
    [f.house],
  );
  expect(transitions.rows[0].count).toBe('4');
});

test('retries survive restart, classification changes and opening revisions; different keys create legitimate duplicates', async () => {
  const f = await fixture();
  const key = randomUUID();
  const responses = await Promise.all(
    Array.from({ length: 4 }, () => post(f, root, key, outflow(f))),
  );
  responses.forEach((response) => expect(response.status).toBe(201));
  responses.forEach((response) =>
    expect(response.body).toEqual(responses[0].body),
  );
  const original = responses[0].body;
  await post(f, root, key, outflow(f, '30100')).expect(409);
  const duplicate = await post(f, root, randomUUID(), outflow(f)).expect(201);
  expect(duplicate.body.eventId).not.toBe(original.eventId);
  const linkKey = randomUUID();
  const path = `${root}/${original.eventId}/arrival-links`;
  const linked = await post(f, path, linkKey, arrival(f)).expect(201);
  await revise(f, f.source, 1, '2026-02-02');
  await app.close();
  await start();
  expect((await post(f, root, key, outflow(f)).expect(201)).body).toEqual(
    original,
  );
  expect((await post(f, path, linkKey, arrival(f)).expect(201)).body).toEqual(
    linked.body,
  );
  await post(f, path, linkKey, {
    ...arrival(f),
    reason: 'Outro motivo',
  }).expect(409);
  await admin.query(
    "UPDATE household.memberships SET role='MEMBER' WHERE household_id=$1 AND user_id=$2",
    [f.house, users[1].id],
  );
  await post(f, root, key, outflow(f), 1).expect(409);
});

test('two competing arrivals have one winner and same-key arrival retries return one durable version', async () => {
  const f = await fixture();
  const created = await post(f, root, randomUUID(), outflow(f)).expect(201);
  const path = `${root}/${created.body.eventId}/arrival-links`;
  const keys = [randomUUID(), randomUUID()];
  const competitors = await Promise.all(
    keys.map((key) => post(f, path, key, arrival(f))),
  );
  expect(competitors.map((r) => r.status).sort((a, b) => a - b)).toEqual([
    201, 409,
  ]);
  const winner = competitors.findIndex((r) => r.status === 201);
  expect(
    (await post(f, path, keys[winner], arrival(f)).expect(201)).body,
  ).toEqual(competitors[winner].body);
  const second = await post(f, root, randomUUID(), outflow(f)).expect(201);
  const retryKey = randomUUID();
  const retries = await Promise.all(
    Array.from({ length: 3 }, () =>
      post(
        f,
        `${root}/${second.body.eventId}/arrival-links`,
        retryKey,
        arrival(f),
      ),
    ),
  );
  retries.forEach((response) => {
    expect(response.status).toBe(201);
    expect(response.body).toEqual(retries[0].body);
  });
  const counts = await admin.query(
    'SELECT version,count(*)::text AS count FROM finance.movements WHERE household_id=$1 AND event_id=$2 GROUP BY version ORDER BY version',
    [f.house, created.body.eventId],
  );
  expect(counts.rows).toEqual([
    { version: 1, count: '1' },
    { version: 2, count: '2' },
  ]);
});

test('same-day arrival has no transit; individual cents are bounded while review totals stay exact', async () => {
  const f = await fixture();
  const first = await post(
    f,
    root,
    randomUUID(),
    outflow(f, '9007199254740991'),
  ).expect(201);
  const second = await post(
    f,
    root,
    randomUUID(),
    outflow(f, '9007199254740991'),
  ).expect(201);
  const page1 = (await get(f, `${root}?date=2026-02-01&limit=1`).expect(200))
    .body;
  expect(page1).toMatchObject({ reviewOutflowCents: '18014398509481982' });
  expect(page1.items).toHaveLength(1);
  expect(page1.nextCursor).toBeTruthy();
  const page2 = (
    await get(
      f,
      `${root}?date=2026-02-01&limit=1&cursor=${page1.nextCursor}`,
    ).expect(200)
  ).body;
  expect(page2).toMatchObject({
    reviewOutflowCents: '18014398509481982',
    nextCursor: null,
  });
  expect(new Set([page1.items[0].eventId, page2.items[0].eventId])).toEqual(
    new Set([first.body.eventId, second.body.eventId]),
  );
  expect(
    (await get(f, `accounts/${f.source}/balance?date=2026-02-01`).expect(200))
      .body,
  ).toMatchObject({
    balanceCents: '-18014398509281982',
    negativeBalance: true,
  });
  await post(f, `${root}/${first.body.eventId}/arrival-links`, randomUUID(), {
    ...arrival(f),
    destinationEffectiveDate: '2026-02-01',
  }).expect(201);
  expect(
    (await get(f, 'transfers/in-transit?date=2026-02-01').expect(200)).body
      .totalCents,
  ).toBe('0');
  for (const patch of [
    { amountCents: '0' },
    { amountCents: '9007199254740992' },
    { sourceEffectiveDate: '2026-02-31' },
    { sourceEffectiveDate: '9999-12-31' },
  ])
    await post(f, root, randomUUID(), { ...outflow(f), ...patch }).expect(400);
});

test('session, active role and household scope protect commands, details, lists and historical replay', async () => {
  const f = await fixture();
  const other = await fixture();
  const key = randomUUID();
  const created = await post(f, root, key, outflow(f)).expect(201);
  const path = `${root}/${created.body.eventId}/arrival-links`;
  await request(app.getHttpServer())
    .get(`/api/households/${f.house}/${root}`)
    .expect(401);
  await post(f, root, randomUUID(), outflow(f), 1).expect(403);
  await post(f, path, randomUUID(), arrival(f), 1).expect(403);
  await get(f, `${root}/${created.body.eventId}`, 1).expect(200);
  await get(f, `${root}/${created.body.eventId}`, 2).expect(404);
  await get(f, `${root}?date=2026-02-03`, 2).expect(404);
  await post(f, root, randomUUID(), {
    ...outflow(f),
    sourceAccountId: other.source,
  }).expect(404);
  await post(f, path, randomUUID(), {
    ...arrival(f),
    destinationAccountId: other.destination,
  }).expect(404);
  await post(other, path, randomUUID(), arrival(other)).expect(404);
  for (const patch of [
    { destinationAccountId: f.source },
    { destinationEffectiveDate: '2026-01-31' },
    { destinationEffectiveDate: '9999-12-31' },
    { amountCents: '30100' },
  ])
    await post(f, path, randomUUID(), { ...arrival(f), ...patch }).expect(400);
  await admin.query(
    'UPDATE household.memberships SET active=false WHERE household_id=$1 AND user_id=$2',
    [f.house, users[0].id],
  );
  await post(f, root, key, outflow(f)).expect(404);
  await post(f, path, randomUUID(), arrival(f)).expect(404);
  await get(f, `${root}/${created.body.eventId}`).expect(404);
});

test('failed arrival stages roll back version, credit, pointer, audit and request together', async () => {
  const f = await fixture();
  const created = await post(f, root, randomUUID(), outflow(f)).expect(201);
  const path = `${root}/${created.body.eventId}/arrival-links`;
  for (const [table, condition] of [
    ['event_versions', 'NEW.version = 2'],
    ['movements', "NEW.side = 'TRANSFER_IN'"],
    ['events', 'NEW.current_version = 2'],
    ['outflow_requests', "NEW.operation = 'outflow:link'"],
  ]) {
    const key = randomUUID();
    const name = `outflow_failure_${randomUUID().replaceAll('-', '')}`;
    const operation = table === 'events' ? 'UPDATE' : 'INSERT';
    await admin.query(
      `CREATE FUNCTION finance.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.household_id = '${f.house}'::uuid AND ${condition} THEN RAISE EXCEPTION 'Injected outflow rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${name} AFTER ${operation} ON finance.${table} FOR EACH ROW EXECUTE FUNCTION finance.${name}()`,
    );
    try {
      await post(f, path, key, arrival(f)).expect(500);
      const state = await admin.query(
        'SELECT type,current_version FROM finance.events WHERE household_id=$1 AND id=$2',
        [f.house, created.body.eventId],
      );
      expect(state.rows).toEqual([
        { type: 'UNCLASSIFIED_OUTFLOW', current_version: 1 },
      ]);
      for (const [query, params] of [
        [
          'SELECT count(*)::text AS count FROM finance.event_versions WHERE household_id=$1 AND event_id=$2 AND version=2',
          [f.house, created.body.eventId],
        ],
        [
          'SELECT count(*)::text AS count FROM finance.movements WHERE household_id=$1 AND event_id=$2 AND version=2',
          [f.house, created.body.eventId],
        ],
        [
          'SELECT count(*)::text AS count FROM finance.arrival_links WHERE household_id=$1 AND event_id=$2',
          [f.house, created.body.eventId],
        ],
        [
          'SELECT count(*)::text AS count FROM finance.outflow_requests WHERE household_id=$1 AND request_key=$2',
          [f.house, key],
        ],
      ] as const)
        expect((await admin.query(query, [...params])).rows[0].count).toBe('0');
    } finally {
      await admin.query(
        `DROP TRIGGER ${name} ON finance.${table}; DROP FUNCTION finance.${name}()`,
      );
    }
  }
  await post(f, path, randomUUID(), arrival(f)).expect(201);
});

test('restricted SQL cannot rewrite the historical source or advance the pointer without an audit', async () => {
  const f = await fixture();
  const created = await post(f, root, randomUUID(), outflow(f)).expect(201);
  const client = await restricted.connect();
  try {
    for (const query of [
      "UPDATE finance.events SET current_version=2,type='INTERNAL_TRANSFER' WHERE household_id=$1 AND id=$2",
      'UPDATE finance.event_versions SET amount_cents=1 WHERE household_id=$1 AND event_id=$2 AND version=1',
      'UPDATE finance.movements SET amount_cents=1 WHERE household_id=$1 AND event_id=$2 AND version=1',
    ]) {
      await client.query('BEGIN');
      await expect(
        client.query(query, [f.house, created.body.eventId]),
      ).rejects.toThrow();
      await client.query('ROLLBACK');
    }
    const borrowedEvent = randomUUID();
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO finance.events(id,household_id,type) VALUES ($1,$2,'UNCLASSIFIED_OUTFLOW')",
      [borrowedEvent, f.house],
    );
    await client.query(
      `INSERT INTO finance.event_versions
        (household_id,event_id,version,movement_id,account_id,amount_cents,currency,
         effective_date,description,state,date_provenance,recorded_by_user_id,event_type)
       SELECT household_id,$1,1,movement_id,account_id,amount_cents,currency,
         effective_date,description,state,date_provenance,recorded_by_user_id,event_type
       FROM finance.event_versions WHERE household_id=$2 AND event_id=$3 AND version=1`,
      [borrowedEvent, f.house, created.body.eventId],
    );
    await expect(client.query('COMMIT')).rejects.toThrow();
    await client.query('ROLLBACK');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('membership locks order revocation before or after arrival and prevent unauthorized replay', async () => {
  const f = await fixture();
  const created = await post(f, root, randomUUID(), outflow(f)).expect(201);
  const path = `${root}/${created.body.eventId}/arrival-links`;
  const blocker = await admin.connect();
  const revoker = await admin.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      'UPDATE household.memberships SET active=false WHERE household_id=$1 AND user_id=$2',
      [f.house, users[0].id],
    );
    const rejected = post(f, path, randomUUID(), arrival(f)).then(
      (response) => response,
    );
    await waitForBlocked(1);
    await blocker.query('COMMIT');
    expect((await rejected).status).toBe(404);
    await admin.query(
      'UPDATE household.memberships SET active=true WHERE household_id=$1 AND user_id=$2',
      [f.house, users[0].id],
    );
    const key = randomUUID();
    const lock = `${f.house}:outflow:link:${key}`;
    await blocker.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [
      lock,
    ]);
    const writing = post(f, path, key, arrival(f)).then((response) => response);
    await waitForBlocked(1);
    await revoker.query('BEGIN');
    const revocation = revoker.query(
      'UPDATE household.memberships SET active=false WHERE household_id=$1 AND user_id=$2',
      [f.house, users[0].id],
    );
    await waitForBlocked(2);
    await blocker.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [
      lock,
    ]);
    expect((await writing).status).toBe(201);
    await revocation;
    await revoker.query('COMMIT');
    await post(f, path, key, arrival(f)).expect(404);
  } finally {
    await blocker.query('SELECT pg_advisory_unlock_all()');
    await blocker.query('ROLLBACK');
    await revoker.query('ROLLBACK');
    blocker.release();
    revoker.release();
  }
}, 20000);

test('arrival observes a source or destination opening revision that wins the account lock', async () => {
  for (const side of ['source', 'destination'] as const) {
    const f = await fixture();
    const created = await post(f, root, randomUUID(), outflow(f)).expect(201);
    const blocker = await admin.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        'SELECT id FROM finance.accounts WHERE household_id=$1 AND id=$2 FOR UPDATE',
        [f.house, f[side]],
      );
      const revision = revise(
        f,
        f[side],
        1,
        side === 'source' ? '2026-02-02' : '2026-02-04',
      );
      await waitForBlocked(1);
      const linking = post(
        f,
        `${root}/${created.body.eventId}/arrival-links`,
        randomUUID(),
        arrival(f),
      ).then((response) => response);
      await waitForBlocked(2);
      await blocker.query('COMMIT');
      await revision;
      const linked = await linking;
      expect(linked.status).toBe(201);
      expect(
        linked.body[side === 'source' ? 'sourceState' : 'destinationState'],
      ).toBe('PENDING_PRE_OPENING');
      expect(
        (await get(f, `${root}/${created.body.eventId}`).expect(200)).body,
      ).toMatchObject({ version: 2, type: 'INTERNAL_TRANSFER' });
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
  }
}, 20000);

test('opening revision sees a linked pair when arrival wins each account lock', async () => {
  for (const side of ['source', 'destination'] as const) {
    const f = await fixture();
    const created = await post(f, root, randomUUID(), outflow(f)).expect(201);
    const blocker = await admin.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        'SELECT id FROM finance.accounts WHERE household_id=$1 AND id=$2 FOR UPDATE',
        [f.house, f[side]],
      );
      const linking = post(
        f,
        `${root}/${created.body.eventId}/arrival-links`,
        randomUUID(),
        arrival(f),
      ).then((response) => response);
      await waitForBlocked(1);
      const revision = revise(
        f,
        f[side],
        1,
        side === 'source' ? '2026-02-02' : '2026-02-04',
      );
      await waitForBlocked(2);
      await blocker.query('COMMIT');
      expect((await linking).status).toBe(201);
      await revision;
      const detail = await get(f, `${root}/${created.body.eventId}`).expect(
        200,
      );
      expect(detail.body).toMatchObject({
        version: 2,
        type: 'INTERNAL_TRANSFER',
        [side === 'source' ? 'sourceState' : 'destinationState']:
          'PENDING_PRE_OPENING',
      });
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
  }
}, 20000);
