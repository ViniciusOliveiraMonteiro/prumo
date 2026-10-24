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
