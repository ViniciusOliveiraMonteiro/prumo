import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import pg from 'pg';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { EmailLifecycleService } from '../src/identity/email-lifecycle.service.js';
import { configureHttp } from '../src/http/configure-http.js';

config({ path: '../.env', quiet: true });
const admin = new pg.Pool({ connectionString: process.env.PRUMO_DATABASE_URL });
const password = 'email-lifecycle-test-password';
const email = `email-${randomUUID()}@prumo.test`;
const secondEmail = `email-${randomUUID()}@prumo.test`;
let currentEmail = email;
let app: INestApplication<App>;
let lifecycle: EmailLifecycleService;
let hasher: PasswordHasher;
let userId: string;
let secondUserId: string;
const extraUserIds: string[] = [];

const mutation = (path: string, cookie: string) =>
  request(app.getHttpServer())
    .post(path)
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie);
const cookieOf = (response: { headers: Record<string, unknown> }): string => {
  const value = response.headers['set-cookie'];
  return Array.isArray(value) ? value[0] : String(value);
};
const signIn = async (address = currentEmail) => {
  const response = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email: address, password })
    .expect(200);
  return cookieOf(response);
};

beforeAll(async () => {
  process.env.PRUMO_EMAIL_TRANSPORT = 'capture';
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const users = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$3),($2,$2,$3) RETURNING id',
    [email, secondEmail, hash],
  );
  [userId, secondUserId] = users.rows.map((row) => row.id);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.init();
  lifecycle = app.get(EmailLifecycleService);
  hasher = app.get(PasswordHasher);
});

afterAll(async () => {
  await app?.close();
  if (userId && secondUserId)
    await admin.query('DELETE FROM identity.users WHERE id = ANY($1::uuid[])', [
      [userId, secondUserId, ...extraUserIds],
    ]);
  await admin.end();
  delete process.env.PRUMO_EMAIL_TRANSPORT;
});

test('verifies only the current account and never returns a code in HTTP', async () => {
  const cookie = await signIn();
  const requested = await mutation('/api/auth/email-verification', cookie)
    .send({})
    .expect(202);
  expect(requested.text).toBe('');
  expect(requested.headers['cache-control']).toBe('no-store');
  const captured = lifecycle.takeCaptured();
  expect(captured).toHaveLength(1);
  expect(captured[0]).toMatchObject({
    userId,
    to: email,
    purpose: 'verify_current',
  });
  const otherCookie = await signIn(secondEmail);
  await mutation('/api/auth/email-verification/confirm', otherCookie)
    .send({ code: captured[0].code })
    .expect(422);
  await mutation('/api/auth/email-verification/confirm', cookie)
    .send({ code: captured[0].code })
    .expect(204);
  await mutation('/api/auth/email-verification/confirm', cookie)
    .send({ code: captured[0].code })
    .expect(422);
  const status = await request(app.getHttpServer())
    .get('/api/auth/email-status')
    .set('Cookie', cookie)
    .expect(200);
  expect(status.body).toMatchObject({
    email,
    verified: true,
    pendingChange: null,
  });
});

test('requires both addresses after verification and revokes the old session', async () => {
  const cookie = await signIn();
  const nextEmail = `changed-${randomUUID()}@prumo.test`;
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: nextEmail, currentPassword: password })
    .expect(202);
  const codes = lifecycle.takeCaptured();
  expect(codes).toHaveLength(2);
  const oldCode = codes.find((item) => item.purpose === 'change_old')?.code;
  const newCode = codes.find((item) => item.purpose === 'change_new')?.code;
  expect(oldCode).toBeDefined();
  expect(newCode).toBeDefined();
  await mutation('/api/auth/email-changes/confirm', cookie)
    .send({ newCode })
    .expect(422);
  await mutation('/api/auth/email-changes/confirm', cookie)
    .send({ newCode, oldCode })
    .expect(204);
  expect(lifecycle.takeCaptured()).toEqual([
    { userId, to: email, purpose: 'change_completed', code: '' },
  ]);
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
  const row = await admin.query<{
    email_normalized: string;
    verified: boolean;
  }>(
    'SELECT email_normalized, email_version = verified_email_version AS verified FROM identity.users WHERE id = $1',
    [userId],
  );
  expect(row.rows[0]).toEqual({ email_normalized: nextEmail, verified: true });
  currentEmail = nextEmail;
});

test('rejects a weaker pending change after the old address is verified', async () => {
  const cookie = await signIn(secondEmail);
  const nextEmail = `pending-${randomUUID()}@prumo.test`;
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: nextEmail, currentPassword: password })
    .expect(202);
  const [newProof] = lifecycle.takeCaptured();
  expect(newProof).toMatchObject({ purpose: 'change_new', to: nextEmail });
  await mutation('/api/auth/email-verification', cookie).send({}).expect(202);
  const [oldProof] = lifecycle.takeCaptured();
  expect(oldProof).toMatchObject({
    purpose: 'verify_current',
    to: secondEmail,
  });
  await mutation('/api/auth/email-verification/confirm', cookie)
    .send({ code: oldProof.code })
    .expect(204);
  await mutation('/api/auth/email-changes/confirm', cookie)
    .send({ newCode: newProof.code })
    .expect(422);
  const status = await request(app.getHttpServer())
    .get('/api/auth/email-status')
    .set('Cookie', cookie)
    .expect(200);
  expect(status.body.email).toBe(secondEmail);
  expect(status.body.verified).toBe(true);
});

test('invalidates pending email proofs in the password-change transaction', async () => {
  await admin.query(
    'DELETE FROM identity.email_issue_attempts WHERE user_id = $1',
    [secondUserId],
  );
  const cookie = await signIn(secondEmail);
  const nextEmail = `stale-${randomUUID()}@prumo.test`;
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: nextEmail, currentPassword: password })
    .expect(202);
  const messages = lifecycle.takeCaptured();
  const oldCode = messages.find((item) => item.purpose === 'change_old')?.code;
  const newCode = messages.find((item) => item.purpose === 'change_new')?.code;
  const replacement = 'a-different-test-password-very-long';
  await mutation('/api/auth/change-password', cookie)
    .send({ currentPassword: password, newPassword: replacement })
    .expect(204);
  const signedIn = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email: secondEmail, password: replacement })
    .expect(200);
  await mutation('/api/auth/email-changes/confirm', cookieOf(signedIn))
    .send({ oldCode, newCode })
    .expect(422);
  const rows = await admin.query<{ status: string }>(
    'SELECT status FROM identity.email_change_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [secondUserId],
  );
  expect(rows.rows[0].status).toBe('cancelled');
});

test('keeps issuance limits through repeated 429 responses', async () => {
  const cookie = await signIn();
  await admin.query(
    'DELETE FROM identity.email_issue_attempts WHERE user_id = $1',
    [userId],
  );
  for (let count = 0; count < 5; count += 1) {
    await mutation('/api/auth/email-verification', cookie).send({}).expect(202);
    lifecycle.takeCaptured();
    await admin.query(
      "UPDATE identity.email_issue_attempts SET created_at = now() - interval '2 minutes' WHERE user_id = $1 AND purpose = 'verify_current' AND admitted",
      [userId],
    );
  }
  const rejected = await mutation('/api/auth/email-verification', cookie)
    .send({})
    .expect(429);
  expect(rejected.headers['retry-after']).toBeDefined();
  await mutation('/api/auth/email-verification', cookie).send({}).expect(429);
  const count = await admin.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM identity.email_issue_attempts WHERE user_id = $1 AND purpose = 'verify_current' AND admitted",
    [userId],
  );
  expect(Number(count.rows[0].count)).toBe(5);
});

test('changes an address that was never verified using only its new code', async () => {
  const address = `unverified-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const created = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [address, hash],
  );
  extraUserIds.push(created.rows[0].id);
  const cookie = await signIn(address);
  const nextEmail = `verified-${randomUUID()}@prumo.test`;
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: nextEmail, currentPassword: password })
    .expect(202);
  const [message] = lifecycle.takeCaptured();
  expect(message).toMatchObject({ to: nextEmail, purpose: 'change_new' });
  await mutation('/api/auth/email-changes/confirm', cookie)
    .send({ newCode: message.code })
    .expect(204);
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
  await signIn(nextEmail);
});

test('a sign-in racing with email change cannot leave a usable old-address session', async () => {
  const address = `login-race-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const created = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [address, hash],
  );
  extraUserIds.push(created.rows[0].id);
  const cookie = await signIn(address);
  const nextEmail = `login-race-target-${randomUUID()}@prumo.test`;
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: nextEmail, currentPassword: password })
    .expect(202);
  const [proof] = lifecycle.takeCaptured();
  expect(proof).toMatchObject({ purpose: 'change_new', to: nextEmail });

  let enteredVerify!: () => void;
  let resumeVerify!: () => void;
  const verifying = new Promise<void>((resolve) => {
    enteredVerify = resolve;
  });
  const resume = new Promise<void>((resolve) => {
    resumeVerify = resolve;
  });
  const originalVerify = hasher.verify.bind(hasher);
  const verify = vi
    .spyOn(hasher, 'verify')
    .mockImplementation(async (...args) => {
      enteredVerify();
      await resume;
      return originalVerify(...args);
    });
  let oldSignIn: Awaited<ReturnType<typeof signIn>>;
  try {
    const pendingSignIn = request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .set('Host', 'localhost:3000')
      .set('Origin', 'http://localhost:3000')
      .send({ email: address, password })
      .then((response) => response);
    await verifying;
    await mutation('/api/auth/email-changes/confirm', cookie)
      .send({ newCode: proof.code })
      .expect(204);
    resumeVerify();
    const response = await pendingSignIn;
    expect(response.status).toBe(200);
    oldSignIn = cookieOf(response);
  } finally {
    resumeVerify();
    verify.mockRestore();
  }
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', oldSignIn)
    .expect(401);
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
  await signIn(nextEmail);
});

test('resend replaces the old proof and replay cannot change the address twice', async () => {
  const address = `resend-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const created = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [address, hash],
  );
  const id = created.rows[0].id;
  extraUserIds.push(id);
  const cookie = await signIn(address);
  const destination = `resend-target-${randomUUID()}@prumo.test`;
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: destination, currentPassword: password })
    .expect(202);
  const [previous] = lifecycle.takeCaptured();
  await admin.query(
    "UPDATE identity.email_issue_attempts SET created_at = now() - interval '2 minutes' WHERE user_id = $1 AND purpose = 'change_email'",
    [id],
  );
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: destination, currentPassword: password })
    .expect(202);
  const [replacement] = lifecycle.takeCaptured();
  expect(replacement.code).not.toBe(previous.code);
  await mutation('/api/auth/email-changes/confirm', cookie)
    .send({ newCode: previous.code })
    .expect(422);
  await mutation('/api/auth/email-changes/confirm', cookie)
    .send({ newCode: replacement.code })
    .expect(204);
  const newCookie = await signIn(destination);
  await mutation('/api/auth/email-changes/confirm', newCookie)
    .send({ newCode: replacement.code })
    .expect(422);
  const rows = await admin.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM identity.email_events WHERE user_id = $1 AND kind = 'email_changed'",
    [id],
  );
  expect(rows.rows[0].count).toBe('1');
});

test('cancels a pending change without changing the login', async () => {
  const address = `cancel-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const created = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [address, hash],
  );
  extraUserIds.push(created.rows[0].id);
  const cookie = await signIn(address);
  const destination = `cancel-target-${randomUUID()}@prumo.test`;
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: destination, currentPassword: password })
    .expect(202);
  const [proof] = lifecycle.takeCaptured();
  await mutation('/api/auth/email-changes/cancel', cookie).send({}).expect(204);
  await mutation('/api/auth/email-changes/cancel', cookie).send({}).expect(204);
  await mutation('/api/auth/email-changes/confirm', cookie)
    .send({ newCode: proof.code })
    .expect(422);
  await signIn(address);
  const status = await request(app.getHttpServer())
    .get('/api/auth/email-status')
    .set('Cookie', cookie)
    .expect(200);
  expect(status.body).toMatchObject({
    email: address,
    pendingChange: null,
  });
});

test('invalidates a verification challenge after five wrong codes', async () => {
  const address = `attempts-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const created = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [address, hash],
  );
  extraUserIds.push(created.rows[0].id);
  const cookie = await signIn(address);
  await mutation('/api/auth/email-verification', cookie).send({}).expect(202);
  const [message] = lifecycle.takeCaptured();
  expect(message.code).not.toBe('A'.repeat(22));
  for (let count = 0; count < 5; count += 1)
    await mutation('/api/auth/email-verification/confirm', cookie)
      .send({ code: 'A'.repeat(22) })
      .expect(422);
  await mutation('/api/auth/email-verification/confirm', cookie)
    .send({ code: message.code })
    .expect(422);
  const challenge = await admin.query<{
    failed_attempts: number;
    status: string;
  }>(
    "SELECT failed_attempts, status FROM identity.email_challenges WHERE user_id = $1 AND purpose = 'verify_current' ORDER BY created_at DESC LIMIT 1",
    [created.rows[0].id],
  );
  expect(challenge.rows[0]).toEqual({
    failed_attempts: 5,
    status: 'cancelled',
  });
});

test('limits wrong current passwords without delaying recovery after the window', async () => {
  const address = `password-limit-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const created = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [address, hash],
  );
  const id = created.rows[0].id;
  extraUserIds.push(id);
  const cookie = await signIn(address);
  const target = `target-${randomUUID()}@prumo.test`;
  for (let count = 0; count < 4; count += 1)
    await mutation('/api/auth/email-changes', cookie)
      .send({ newEmail: target, currentPassword: 'wrong-password' })
      .expect(401);
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: target, currentPassword: 'wrong-password' })
    .expect(429);
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: target, currentPassword: password })
    .expect(429);
  const counted = await admin.query<{ attempts: number }>(
    'SELECT attempts FROM identity.email_current_password_attempts WHERE user_id = $1',
    [id],
  );
  expect(counted.rows[0].attempts).toBe(5);
  await admin.query(
    "UPDATE identity.email_current_password_attempts SET window_started_at = now() - interval '16 minutes' WHERE user_id = $1",
    [id],
  );
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: target, currentPassword: password })
    .expect(202);
  expect(lifecycle.takeCaptured()).toMatchObject([
    { userId: id, to: target, purpose: 'change_new' },
  ]);
});

test('keeps an occupied destination opaque and does not send to its owner', async () => {
  const address = `collision-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const created = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [address, hash],
  );
  const id = created.rows[0].id;
  extraUserIds.push(id);
  const cookie = await signIn(address);
  const response = await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: secondEmail, currentPassword: password })
    .expect(202);
  expect(response.text).toBe('');
  expect(response.headers['cache-control']).toBe('no-store');
  expect(lifecycle.takeCaptured()).toEqual([]);
  const status = await request(app.getHttpServer())
    .get('/api/auth/email-status')
    .set('Cookie', cookie)
    .expect(200);
  expect(status.body.pendingChange).toMatchObject({ newEmail: secondEmail });
  await mutation('/api/auth/email-changes/confirm', cookie)
    .send({ newCode: 'A'.repeat(22) })
    .expect(422);
  const unchanged = await admin.query<{ email_normalized: string }>(
    'SELECT email_normalized FROM identity.users WHERE id = $1',
    [id],
  );
  expect(unchanged.rows[0].email_normalized).toBe(address);
});

test('occupied and free destinations have no gross local timing or log difference', async () => {
  const durations = { occupied: [] as number[], free: [] as number[] };
  const statusDurations = { occupied: [] as number[], free: [] as number[] };
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const stdout = vi.spyOn(process.stdout, 'write');
  const stderr = vi.spyOn(process.stderr, 'write');
  const addresses: string[] = [secondEmail];
  try {
    for (let sample = 0; sample < 8; sample += 1) {
      const order: ('occupied' | 'free')[] =
        sample % 2 === 0 ? ['occupied', 'free'] : ['free', 'occupied'];
      for (const kind of order) {
        const address = `timing-${randomUUID()}@prumo.test`;
        const target =
          kind === 'occupied'
            ? secondEmail
            : `timing-target-${randomUUID()}@prumo.test`;
        addresses.push(address, target);
        const created = await admin.query<{ id: string }>(
          'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
          [address, hash],
        );
        extraUserIds.push(created.rows[0].id);
        const cookie = await signIn(address);
        const started = performance.now();
        const response = await mutation('/api/auth/email-changes', cookie)
          .send({ newEmail: target, currentPassword: password })
          .expect(202);
        durations[kind].push(performance.now() - started);
        expect(response.text).toBe('');
        expect(response.headers['cache-control']).toBe('no-store');
        const statusStarted = performance.now();
        const status = await request(app.getHttpServer())
          .get('/api/auth/email-status')
          .set('Cookie', cookie)
          .expect(200);
        statusDurations[kind].push(performance.now() - statusStarted);
        expect(status.headers['cache-control']).toBe('no-store');
        expect(status.body.pendingChange).toMatchObject({
          newEmail: target,
          requiresOldCode: false,
        });
        const captured = lifecycle.takeCaptured();
        expect(captured).toHaveLength(kind === 'free' ? 1 : 0);
      }
    }
    const written = [...stdout.mock.calls, ...stderr.mock.calls]
      .map(([chunk]) => String(chunk))
      .join('');
    for (const address of addresses) expect(written).not.toContain(address);
    const median = (values: number[]) => {
      const sorted = [...values].sort((left, right) => left - right);
      return (sorted[3] + sorted[4]) / 2;
    };
    expect(
      Math.abs(median(durations.occupied) - median(durations.free)),
    ).toBeLessThan(75);
    expect(
      Math.abs(median(statusDurations.occupied) - median(statusDurations.free)),
    ).toBeLessThan(75);
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
}, 30_000);

test('private UUID invitation and email change work in both row-lock orders', async () => {
  const ownerEmail = `invite-owner-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const owner = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [ownerEmail, hash],
  );
  extraUserIds.push(owner.rows[0].id);
  const ownerCookie = await signIn(ownerEmail);
  const householdIds: string[] = [];
  try {
    for (const first of ['invite', 'change'] as const) {
      const inviteeEmail = `invitee-${randomUUID()}@prumo.test`;
      const created = await admin.query<{ id: string }>(
        'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
        [inviteeEmail, hash],
      );
      const inviteeId = created.rows[0].id;
      extraUserIds.push(inviteeId);
      const inviteeCookie = await signIn(inviteeEmail);
      const household = await mutation('/api/households', ownerCookie)
        .send({ name: `Email change race ${randomUUID()}` })
        .expect(201);
      const householdId = household.body.id as string;
      householdIds.push(householdId);
      const nextEmail = `invitee-new-${randomUUID()}@prumo.test`;
      await mutation('/api/auth/email-changes', inviteeCookie)
        .send({ newEmail: nextEmail, currentPassword: password })
        .expect(202);
      const [proof] = lifecycle.takeCaptured();
      expect(proof).toMatchObject({ to: nextEmail, purpose: 'change_new' });

      const blocker = await admin.connect();
      const pending: Promise<request.Response>[] = [];
      let locked = false;
      try {
        await blocker.query('BEGIN');
        locked = true;
        await blocker.query(
          'SELECT id FROM identity.users WHERE id = $1 FOR UPDATE',
          [inviteeId],
        );
        const operations = {
          invite: () =>
            mutation(`/api/households/${householdId}/invitations`, ownerCookie)
              .send({ inviteeUserId: inviteeId })
              .then((response) => response),
          change: () =>
            mutation('/api/auth/email-changes/confirm', inviteeCookie)
              .send({ newCode: proof.code })
              .then((response) => response),
        };
        const waitForBlocked = async (count: number) => {
          for (let attempt = 0; attempt < 100; attempt += 1) {
            const activity = await admin.query<{ count: string }>(
              "SELECT count(*)::text AS count FROM pg_stat_activity WHERE usename = 'prumo_app' AND wait_event_type = 'Lock' AND cardinality(pg_blocking_pids(pid)) > 0",
            );
            if (Number(activity.rows[0].count) >= count) return;
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          throw new Error(`Expected ${count} operations blocked by user row`);
        };
        pending.push(operations[first]());
        await waitForBlocked(1);
        pending.push(operations[first === 'invite' ? 'change' : 'invite']());
        await waitForBlocked(2);
        await blocker.query('COMMIT');
        locked = false;
        const [firstResponse, secondResponse] = await Promise.all(pending);
        const invitation = first === 'invite' ? firstResponse : secondResponse;
        const changed = first === 'change' ? firstResponse : secondResponse;
        expect(invitation.status).toBe(202);
        expect(changed.status).toBe(204);
        const newCookie = await signIn(nextEmail);
        const inbox = await request(app.getHttpServer())
          .get('/api/auth/invitations')
          .set('Cookie', newCookie)
          .expect(200);
        expect(inbox.body).toEqual([
          expect.objectContaining({
            id: invitation.body.requestId,
            householdId,
            role: 'VIEWER',
          }),
        ]);
        await mutation(
          `/api/auth/invitations/${invitation.body.requestId}/accept`,
          newCookie,
        )
          .send({})
          .expect(204);
        const membership = await admin.query<{ role: string }>(
          'SELECT role FROM household.memberships WHERE household_id = $1 AND user_id = $2 AND active',
          [householdId, inviteeId],
        );
        expect(membership.rows).toEqual([{ role: 'VIEWER' }]);
      } finally {
        if (locked) await blocker.query('ROLLBACK');
        blocker.release();
        await Promise.allSettled(pending);
      }
    }
  } finally {
    for (const householdId of householdIds) {
      await admin.query(
        'DELETE FROM household.events WHERE household_id = $1',
        [householdId],
      );
      await admin.query(
        'DELETE FROM household.invitation_requests WHERE household_id = $1',
        [householdId],
      );
      await admin.query(
        'DELETE FROM household.invitations WHERE household_id = $1',
        [householdId],
      );
      await admin.query(
        'DELETE FROM household.memberships WHERE household_id = $1',
        [householdId],
      );
      await admin.query('DELETE FROM household.households WHERE id = $1', [
        householdId,
      ]);
    }
  }
}, 30_000);

test('password recovery cancels a pending email change', async () => {
  const address = `recover-pending-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const created = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [address, hash],
  );
  const id = created.rows[0].id;
  extraUserIds.push(id);
  const cookie = await signIn(address);
  const issued = await mutation('/api/auth/recovery-codes', cookie)
    .send({ currentPassword: password })
    .expect(201);
  const nextEmail = `after-recovery-${randomUUID()}@prumo.test`;
  await mutation('/api/auth/email-changes', cookie)
    .send({ newEmail: nextEmail, currentPassword: password })
    .expect(202);
  const [proof] = lifecycle.takeCaptured();
  const replacement = 'a-new-password-after-recovery';
  await request(app.getHttpServer())
    .post('/api/auth/recover-with-code')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({
      email: address,
      code: issued.body.codes[0],
      newPassword: replacement,
    })
    .expect(200);
  const signedIn = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email: address, password: replacement })
    .expect(200);
  await mutation('/api/auth/email-changes/confirm', cookieOf(signedIn))
    .send({ newCode: proof.code })
    .expect(422);
  const pending = await admin.query<{ status: string }>(
    'SELECT status FROM identity.email_change_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [id],
  );
  expect(pending.rows[0].status).toBe('cancelled');
});

test('rolls back a verification request when audit insertion fails', async () => {
  const address = `audit-rollback-${randomUUID()}@prumo.test`;
  const hash = await new PasswordHasher({ logN: 10 }).hash(password);
  const created = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1,$1,$2) RETURNING id',
    [address, hash],
  );
  const id = created.rows[0].id;
  extraUserIds.push(id);
  const cookie = await signIn(address);
  const constraint = `email_event_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(
    `ALTER TABLE identity.email_events ADD CONSTRAINT ${constraint}
      CHECK (user_id <> '${id}'::uuid)`,
  );
  try {
    await mutation('/api/auth/email-verification', cookie).send({}).expect(500);
  } finally {
    await admin.query(
      `ALTER TABLE identity.email_events DROP CONSTRAINT ${constraint}`,
    );
  }
  expect(lifecycle.takeCaptured()).toEqual([]);
  const rows = await admin.query<{
    challenges: string;
    outbox: string;
    issues: string;
  }>(
    `SELECT
       (SELECT count(*) FROM identity.email_challenges WHERE user_id = $1)::text AS challenges,
       (SELECT count(*) FROM identity.email_delivery_outbox WHERE user_id = $1)::text AS outbox,
       (SELECT count(*) FROM identity.email_issue_attempts WHERE user_id = $1)::text AS issues`,
    [id],
  );
  expect(rows.rows[0]).toEqual({ challenges: '0', outbox: '0', issues: '0' });
});
