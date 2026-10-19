import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher, SignInService } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http/configure-http.js';

config({ path: '../.env', quiet: true });
const connectionString = process.env.PRUMO_DATABASE_URL;
if (!connectionString) throw new Error('PRUMO_DATABASE_URL is required');
const owner = new pg.Pool({ connectionString });
const email = `recovery-${randomUUID()}@prumo.test`;
const oldPassword = 'recovery-original-password';
const newPassword = 'recovery-new-password';
let app: INestApplication<App>;
let userId: string;
let signInService: SignInService;

function cookieOf(response: { headers: Record<string, unknown> }): string {
  const value = response.headers['set-cookie'];
  if (Array.isArray(value)) return value[0] as string;
  return value as string;
}

const signIn = (password: string) =>
  request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password });

const issue = (cookie: string, currentPassword: string) =>
  request(app.getHttpServer())
    .post('/api/auth/recovery-codes')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .send({ currentPassword });

const recover = (targetEmail: string, code: string, password = newPassword) =>
  request(app.getHttpServer())
    .post('/api/auth/recover-with-code')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email: targetEmail, code, newPassword: password });

beforeAll(async () => {
  const passwordHash = await new PasswordHasher({ logN: 10 }).hash(oldPassword);
  const row = await owner.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1, $1, $2) RETURNING id',
    [email, passwordHash],
  );
  userId = row.rows[0].id;
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  signInService = moduleRef.get(SignInService);
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.init();
});

afterAll(async () => {
  await app?.close();
  if (userId)
    await owner.query('DELETE FROM identity.users WHERE id = $1', [userId]);
  const subjectHash = createHash('sha256').update(email).digest('hex');
  await owner.query(
    'DELETE FROM identity.sign_in_attempts WHERE subject_hash = $1',
    [subjectHash],
  );
  await owner.query(
    'DELETE FROM identity.recovery_attempts WHERE subject_hash = $1',
    [subjectHash],
  );
  await owner.end();
});

test('issues codes once with reauthentication and replaces the previous set', async () => {
  const cookie = cookieOf(await signIn(oldPassword).expect(200));
  await issue(cookie, 'wrong-password').expect(401);
  const first = await issue(cookie, oldPassword).expect(201);
  expect(first.headers['cache-control']).toBe('no-store');
  expect(first.body.codes).toHaveLength(8);
  expect(new Set(first.body.codes).size).toBe(8);
  const second = await issue(cookie, oldPassword).expect(201);
  expect(second.body.codes).toHaveLength(8);
  const stored = await owner.query<{ code_hash: string }>(
    'SELECT code_hash FROM identity.recovery_codes WHERE user_id = $1',
    [userId],
  );
  expect(stored.rows).toHaveLength(8);
  expect(
    stored.rows.some(({ code_hash }) => second.body.codes.includes(code_hash)),
  ).toBe(false);
  await recover(email, first.body.codes[0]).expect(401);
  const recovered = await recover(email, second.body.codes[0]).expect(200);
  expect(recovered.body.codes).toHaveLength(8);
  expect(recovered.headers['cache-control']).toBe('no-store');
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
  await signIn(oldPassword).expect(401);
  await signIn(newPassword).expect(200);
  await recover(email, second.body.codes[0]).expect(401);
  await recover(email, second.body.codes[1]).expect(401);
  const events = await owner.query<{ kind: string }>(
    'SELECT kind FROM identity.credential_events WHERE user_id = $1 ORDER BY created_at',
    [userId],
  );
  expect(events.rows.map(({ kind }) => kind).sort()).toEqual([
    'password_recovered',
    'recovery_codes_issued',
    'recovery_codes_issued',
  ]);
});

test('returns the same failure for unknown accounts and limits repeated guesses', async () => {
  const unknown = `unknown-${randomUUID()}@prumo.test`;
  const invalidCode = 'A'.repeat(22);
  await owner.query(
    'DELETE FROM identity.recovery_attempts WHERE subject_hash = $1',
    [createHash('sha256').update(email).digest('hex')],
  );
  await recover(unknown, invalidCode).expect(401);
  await owner.query(
    'DELETE FROM identity.recovery_attempts WHERE subject_hash = $1',
    [createHash('sha256').update(unknown).digest('hex')],
  );
  for (let attempt = 1; attempt < 5; attempt++) {
    await recover(email, invalidCode).expect(401);
  }
  await recover(email, invalidCode).expect(401);
  await recover(email, invalidCode).expect(429);
  await owner.query(
    'DELETE FROM identity.recovery_attempts WHERE subject_hash = $1',
    [createHash('sha256').update(email).digest('hex')],
  );
});

test('a login verified before recovery cannot keep a session issued afterward', async () => {
  const cookie = cookieOf(await signIn(newPassword).expect(200));
  const issued = await issue(cookie, newPassword).expect(201);
  const thirdPassword = 'recovery-after-concurrent-login';
  let resumeSignIn!: () => void;
  let signalSignIn!: () => void;
  const released = new Promise<void>((resolve) => (resumeSignIn = resolve));
  const entered = new Promise<void>((resolve) => (signalSignIn = resolve));
  const original = signInService.signIn.bind(signInService);
  const spy = vi
    .spyOn(signInService, 'signIn')
    .mockImplementationOnce(async (...args) => {
      signalSignIn();
      await released;
      return original(...args);
    });
  const delayedLogin = signIn(newPassword).then((response) => response);
  await entered;
  try {
    await recover(email, issued.body.codes[0], thirdPassword).expect(200);
  } finally {
    resumeSignIn();
  }
  const response = await delayedLogin;
  spy.mockRestore();
  expect(response.status).toBe(200);
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookieOf(response))
    .expect(401);
  await signIn(newPassword).expect(401);
  await signIn(thirdPassword).expect(200);
});

test('rolls back code use and password update when session revocation fails', async () => {
  const currentPassword = 'recovery-after-concurrent-login';
  const cookie = cookieOf(await signIn(currentPassword).expect(200));
  const issued = await issue(cookie, currentPassword).expect(201);
  const code = issued.body.codes[0] as string;
  const triggerName = `test_recovery_${randomUUID().replaceAll('-', '')}`;
  await owner.query(`
    CREATE FUNCTION identity.${triggerName}() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'injected recovery revocation failure';
    END;
    $$
  `);
  try {
    await owner.query(`
      CREATE TRIGGER ${triggerName}
      BEFORE DELETE ON identity.sessions
      FOR EACH ROW WHEN (OLD.user_id = '${userId}'::uuid)
      EXECUTE FUNCTION identity.${triggerName}()
    `);
    await recover(email, code, 'password-after-rollback').expect(500);
  } finally {
    await owner.query(
      `DROP TRIGGER IF EXISTS ${triggerName} ON identity.sessions`,
    );
    await owner.query(`DROP FUNCTION identity.${triggerName}()`);
  }
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(200);
  await signIn('password-after-rollback').expect(401);
  await recover(email, code, 'password-after-rollback').expect(200);
  await signIn('password-after-rollback').expect(200);
});

test('one concurrent redemption wins and a foreign origin is refused', async () => {
  const currentPassword = 'password-after-rollback';
  const cookie = cookieOf(await signIn(currentPassword).expect(200));
  const issued = await issue(cookie, currentPassword).expect(201);
  const code = issued.body.codes[0] as string;
  await request(app.getHttpServer())
    .post('/api/auth/recover-with-code')
    .set('Host', 'localhost:3000')
    .set('Origin', 'https://foreign.test')
    .send({ email, code, newPassword: 'foreign-origin-password' })
    .expect(403);
  const passwords = ['concurrent-password-a', 'concurrent-password-b'];
  const responses = await Promise.all(
    passwords.map((password) => recover(email, code, password)),
  );
  expect(responses.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
    200, 401,
  ]);
  const winner = passwords[responses.findIndex(({ status }) => status === 200)];
  const loser = passwords[responses.findIndex(({ status }) => status === 401)];
  await signIn(currentPassword).expect(401);
  await signIn(loser).expect(401);
  const winnerCookie = cookieOf(await signIn(winner).expect(200));
  const nextCodes = await issue(winnerCookie, winner).expect(201);
  await request(app.getHttpServer())
    .post('/api/auth/change-password')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', winnerCookie)
    .send({ currentPassword: winner, newPassword: 'password-after-change' })
    .expect(204);
  await recover(email, nextCodes.body.codes[0], 'reused-code-password').expect(
    401,
  );
  await signIn('password-after-change').expect(200);
});
