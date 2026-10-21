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
  throw new Error('Local database URLs are required');
const admin = new pg.Pool({ connectionString });
const restricted = new pg.Pool({ connectionString: appConnectionString });
const users: { id: string; email: string; cookie: string }[] = [];
const extraUserIds: string[] = [];
const households: string[] = [];
let app: INestApplication<App>;
let a: string;
let b: string;

function post(path: string, actor: number, body?: object) {
  const call = request(app.getHttpServer())
    .post(path)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', users[actor].cookie);
  return body ? call.send(body) : call;
}

function create(id: string, invitee: string, actor = 0) {
  return post(`/api/households/${id}/invitations`, actor, {
    inviteeUserId: invitee,
  });
}

function inbox(actor: number) {
  return request(app.getHttpServer())
    .get('/api/auth/invitations')
    .set('Cookie', users[actor].cookie);
}

function accept(id: string, actor: number) {
  return post(`/api/auth/invitations/${id}/accept`, actor);
}

function cancel(householdId: string, id: string, actor = 0) {
  return post(`/api/households/${householdId}/invitations/${id}/cancel`, actor);
}

async function createHousehold(actor: number): Promise<string> {
  const response = await post('/api/households', actor, {
    name: `Invitation test ${randomUUID()}`,
  }).expect(201);
  const id = response.body.id as string;
  households.push(id);
  return id;
}

async function waitForBlocked(client: pg.PoolClient, blockerPid: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))`,
      [blockerPid],
    );
    if (Number(result.rows[0].count) >= 1) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Expected invitation operation to wait for a row lock');
}

beforeAll(async () => {
  const password = 'invitation-test-password-long-enough';
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  for (let index = 0; index < 5; index++) {
    const email = `invitation-${randomUUID()}@prumo.test`;
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
     VALUES ($1, $2, 'MEMBER')`,
    [a, users[3].id],
  );
});

afterAll(async () => {
  await app?.close();
  for (const id of households) {
    await admin.query('DELETE FROM household.events WHERE household_id = $1', [
      id,
    ]);
    await admin.query(
      'DELETE FROM household.invitation_requests WHERE household_id = $1',
      [id],
    );
    await admin.query(
      'DELETE FROM household.invitations WHERE household_id = $1',
      [id],
    );
    await admin.query(
      'DELETE FROM household.memberships WHERE household_id = $1',
      [id],
    );
    await admin.query('DELETE FROM household.households WHERE id = $1', [id]);
  }
  for (const user of users)
    await admin.query('DELETE FROM identity.users WHERE id = $1', [user.id]);
  if (extraUserIds.length)
    await admin.query('DELETE FROM identity.users WHERE id = ANY($1::uuid[])', [
      extraUserIds,
    ]);
  await admin.end();
  await restricted.end();
});

test('owner can invite only within own household without enumerating recipients', async () => {
  const old = await admin.query<{ id: string }>(
    `INSERT INTO household.invitation_requests(household_id, actor_user_id, created_at)
     VALUES ($1, $2, clock_timestamp() - interval '31 days') RETURNING id`,
    [b, users[1].id],
  );
  const real = await create(a, users[2].id).expect(202);
  const removed = await admin.query(
    'SELECT 1 FROM household.invitation_requests WHERE id = $1',
    [old.rows[0].id],
  );
  expect(removed.rowCount).toBe(0);
  const unknown = await create(a, randomUUID()).expect(202);
  const existing = await create(a, users[3].id).expect(202);
  const duplicate = await create(a, users[2].id).expect(202);
  for (const response of [real, unknown, existing, duplicate]) {
    expect(response.body).toEqual({ requestId: expect.any(String) });
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect(real.body.requestId).not.toBe(duplicate.body.requestId);
  expect((await inbox(2).expect(200)).body).toEqual([
    expect.objectContaining({
      id: real.body.requestId,
      householdId: a,
      role: 'VIEWER',
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }),
  ]);
  expect((await inbox(1).expect(200)).body).toEqual([]);
  await create(b, users[2].id).expect(404);
  await create(a, users[2].id, 3).expect(403);
  await create(a, 'invalid').expect(400);
  await request(app.getHttpServer())
    .post(`/api/households/${a}/invitations`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ inviteeUserId: users[2].id })
    .expect(401);
  const hostile = await request(app.getHttpServer())
    .post(`/api/households/${a}/invitations`)
    .set('Host', 'localhost:3000')
    .set('Origin', 'https://hostile.test')
    .set('Cookie', users[0].cookie)
    .send({ inviteeUserId: users[2].id })
    .expect(403);
  expect(hostile.headers['cache-control']).toBe('no-store');
  const events = await admin.query(
    "SELECT * FROM household.events WHERE household_id = $1 AND kind = 'invitation_created'",
    [a],
  );
  expect(events.rowCount).toBe(1);
});

test('only invitee accepts, replay is idempotent, and revocation cannot be undone', async () => {
  const created = await create(a, users[2].id).expect(202);
  const id = created.body.requestId as string;
  await request(app.getHttpServer())
    .get(`/api/households/${a}`)
    .set('Cookie', users[2].cookie)
    .expect(404);
  await accept(id, 1).expect(404);
  await accept(id, 2).expect(204);
  await accept(id, 2).expect(204);
  await cancel(a, id).expect(204);
  await request(app.getHttpServer())
    .get(`/api/households/${a}`)
    .set('Cookie', users[2].cookie)
    .expect(200);
  await post(
    `/api/households/${a}/memberships/${users[2].id}/revoke`,
    0,
  ).expect(204);
  await accept(id, 2).expect(409);
  await create(a, users[2].id).expect(202);
  expect(
    (await inbox(2).expect(200)).body.filter(
      (invitation: { householdId: string }) => invitation.householdId === a,
    ),
  ).toEqual([]);
  const events = await admin.query<{ kind: string }>(
    "SELECT kind FROM household.events WHERE household_id = $1 AND kind LIKE 'invitation_%' ORDER BY created_at",
    [a],
  );
  expect(events.rows.map((row) => row.kind)).toEqual([
    'invitation_created',
    'invitation_accepted',
  ]);
});

test('cancel and expiry prevent acceptance; new invite after expiry is possible', async () => {
  const first = await create(a, users[2].id).expect(202);
  await cancel(b, first.body.requestId).expect(404);
  await cancel(a, first.body.requestId, 3).expect(403);
  await cancel(a, first.body.requestId).expect(204);
  await cancel(a, first.body.requestId).expect(204);
  await accept(first.body.requestId, 2).expect(404);
  const second = await create(a, users[2].id).expect(202);
  await admin.query(
    "UPDATE household.invitations SET created_at = clock_timestamp() - interval '8 days', expires_at = clock_timestamp() - interval '1 second' WHERE id = $1",
    [second.body.requestId],
  );
  expect(
    (await inbox(2).expect(200)).body.filter(
      (invitation: { householdId: string }) => invitation.householdId === a,
    ),
  ).toEqual([]);
  await accept(second.body.requestId, 2).expect(404);
  const third = await create(a, users[2].id).expect(202);
  expect(third.body.requestId).not.toBe(second.body.requestId);
  await accept(third.body.requestId, 2).expect(204);
  const events = await admin.query<{ kind: string }>(
    "SELECT kind FROM household.events WHERE household_id = $1 AND kind LIKE 'invitation_%' ORDER BY created_at",
    [a],
  );
  expect(events.rows.map((row) => row.kind)).toEqual([
    'invitation_created',
    'invitation_cancelled',
    'invitation_created',
    'invitation_created',
    'invitation_accepted',
  ]);
});

test('failed audit rolls back acceptance and keeps invitation pending', async () => {
  const created = await create(a, users[2].id).expect(202);
  const functionName = `invitation_audit_fail_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE FUNCTION household.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.kind = 'invitation_accepted' THEN RAISE EXCEPTION 'injected invitation audit failure'; END IF;
    RETURN NEW; END $$`);
  await admin.query(`CREATE TRIGGER ${functionName} BEFORE INSERT ON household.events
    FOR EACH ROW EXECUTE FUNCTION household.${functionName}()`);
  try {
    await accept(created.body.requestId, 2).expect(500);
    const state = await admin.query<{ state: string }>(
      'SELECT state FROM household.invitations WHERE id = $1',
      [created.body.requestId],
    );
    expect(state.rows[0].state).toBe('pending');
    const membership = await admin.query(
      'SELECT 1 FROM household.memberships WHERE household_id = $1 AND user_id = $2',
      [a, users[2].id],
    );
    expect(membership.rowCount).toBe(0);
  } finally {
    await admin.query(`DROP TRIGGER ${functionName} ON household.events`);
    await admin.query(`DROP FUNCTION household.${functionName}()`);
  }
  await accept(created.body.requestId, 2).expect(204);
});

test('restricted role has only required invitation grants and simultaneous accepts create one membership', async () => {
  const grants = await restricted.query<{
    invitation_select: boolean;
    invitation_delete: boolean;
    event_select: boolean;
  }>(`SELECT has_table_privilege(current_user, 'household.invitations', 'SELECT') AS invitation_select,
      has_table_privilege(current_user, 'household.invitations', 'DELETE') AS invitation_delete,
      has_table_privilege(current_user, 'household.events', 'SELECT') AS event_select`);
  expect(grants.rows[0]).toEqual({
    invitation_select: true,
    invitation_delete: false,
    event_select: false,
  });
  const created = await create(a, users[2].id).expect(202);
  const responses = await Promise.all([
    accept(created.body.requestId, 2),
    accept(created.body.requestId, 2),
  ]);
  expect(responses.map((response) => response.status)).toEqual([204, 204]);
  const events = await admin.query(
    "SELECT 1 FROM household.events WHERE household_id = $1 AND kind = 'invitation_accepted'",
    [a],
  );
  expect(events.rowCount).toBe(1);
});

test('cancel and accept serialize in either order without duplicate audit', async () => {
  for (const first of ['cancel', 'accept'] as const) {
    const created = await create(a, users[2].id).expect(202);
    const id = created.body.requestId as string;
    const blocker = await admin.connect();
    const inspector = await admin.connect();
    try {
      await blocker.query('BEGIN');
      const pid = await blocker.query<{ pid: number }>(
        'SELECT pg_backend_pid() AS pid',
      );
      await blocker.query(
        'SELECT 1 FROM household.invitations WHERE id = $1 FOR UPDATE',
        [id],
      );
      const firstCall = first === 'cancel' ? cancel(a, id) : accept(id, 2);
      const firstPromise = firstCall.then((response) => response);
      await waitForBlocked(inspector, pid.rows[0].pid);
      const secondPromise = (
        first === 'cancel' ? accept(id, 2) : cancel(a, id)
      ).then((response) => response);
      await blocker.query('COMMIT');
      const [firstResponse, secondResponse] = await Promise.all([
        firstPromise,
        secondPromise,
      ]);
      expect(firstResponse.status).toBe(204);
      expect(secondResponse.status).toBe(first === 'cancel' ? 404 : 204);
      const state = await admin.query<{ state: string }>(
        'SELECT state FROM household.invitations WHERE id = $1',
        [id],
      );
      expect(state.rows[0].state).toBe(
        first === 'cancel' ? 'cancelled' : 'accepted',
      );
      const audit = await admin.query<{ kind: string }>(
        `SELECT kind FROM household.events WHERE invitation_id = $1
         AND kind IN ('invitation_cancelled', 'invitation_accepted')`,
        [id],
      );
      expect(audit.rows).toEqual([
        {
          kind:
            first === 'cancel' ? 'invitation_cancelled' : 'invitation_accepted',
        },
      ]);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      inspector.release();
    }
  }
});

test('audit constraints reject missing revocation role and cross-household invitation events', async () => {
  await expect(
    admin.query(
      `INSERT INTO household.events(household_id, actor_user_id, kind,
       target_user_id, previous_role) VALUES ($1, $2, 'membership_revoked', $3, NULL)`,
      [a, users[0].id, users[3].id],
    ),
  ).rejects.toMatchObject({ code: '23514' });
  const invited = await create(b, users[2].id, 1).expect(202);
  await expect(
    admin.query(
      `INSERT INTO household.events(household_id, actor_user_id, kind,
       invitation_id, invitee_user_id)
       VALUES ($1, $2, 'invitation_created', $3, $4)`,
      [a, users[0].id, invited.body.requestId, users[2].id],
    ),
  ).rejects.toMatchObject({ code: '23503' });
});

test('two owners cannot exceed the household pending invitation cap', async () => {
  await admin.query(
    `INSERT INTO household.memberships(household_id, user_id, role)
     VALUES ($1, $2, 'OWNER')`,
    [a, users[1].id],
  );
  const prefix = `invitation-cap-${randomUUID()}`;
  const seeded = await admin.query<{ id: string }>(
    `INSERT INTO identity.users(email, email_normalized, password_hash)
     SELECT $1 || '-' || n::text || '@prumo.test',
            $1 || '-' || n::text || '@prumo.test', 'fixture-hash'
     FROM generate_series(1, 99) AS n RETURNING id`,
    [prefix],
  );
  extraUserIds.push(...seeded.rows.map((row) => row.id));
  await admin.query(
    `INSERT INTO household.invitations(household_id, inviter_user_id, invitee_user_id)
     SELECT $1, $2, unnest($3::uuid[])`,
    [a, users[0].id, extraUserIds],
  );
  const responses = await Promise.all([
    create(a, users[2].id),
    create(a, users[4].id, 1),
  ]);
  expect(responses.map((response) => response.status)).toEqual([202, 202]);
  const count = await admin.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM household.invitations
     WHERE household_id = $1 AND state = 'pending'`,
    [a],
  );
  expect(count.rows[0].count).toBe('100');
  const delivered = [2, 4].map(async (index) => {
    const received = await inbox(index).expect(200);
    return received.body.some(
      (invitation: { householdId: string }) => invitation.householdId === a,
    );
  });
  expect((await Promise.all(delivered)).filter(Boolean)).toHaveLength(1);
});

test('request limit counts unknown recipients without disclosing account existence', async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const target = attempt % 2 ? users[2].id : randomUUID();
    const response = await create(a, target).expect(202);
    expect(response.body).toEqual({ requestId: expect.any(String) });
  }
  await create(a, users[2].id).expect(429);
  await create(b, users[2].id, 1).expect(202);
});

test('recipient existence has no gross response-time or log difference locally', async () => {
  const known: number[] = [];
  const unknown: number[] = [];
  const stdout = vi.spyOn(process.stdout, 'write');
  const stderr = vi.spyOn(process.stderr, 'write');
  try {
    for (let sample = 0; sample < 8; sample++) {
      for (const eligible of sample % 2 ? [false, true] : [true, false]) {
        const target = eligible ? users[2].id : randomUUID();
        const started = performance.now();
        const response = await create(a, target).expect(202);
        (eligible ? known : unknown).push(performance.now() - started);
        expect(response.body).toEqual({ requestId: expect.any(String) });
        if (eligible) await cancel(a, response.body.requestId).expect(204);
      }
    }
    const written = [...stdout.mock.calls, ...stderr.mock.calls]
      .map(([chunk]) => String(chunk))
      .join('');
    expect(written).not.toContain(users[2].id);
    function median(values: number[]) {
      const ordered = [...values].sort((left, right) => left - right);
      return (ordered[3] + ordered[4]) / 2;
    }
    expect(Math.abs(median(known) - median(unknown))).toBeLessThan(50);
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});
