import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http/configure-http.js';

config({ path: '../.env', quiet: true });
const connectionString = process.env.PRUMO_DATABASE_URL;
if (!connectionString) throw new Error('PRUMO_DATABASE_URL is required');
const owner = new pg.Pool({ connectionString });
const email = `change-${randomUUID()}@prumo.test`;
const firstPassword = 'first-test-password-with-adequate-length';
const secondPassword = 'second-test-password-with-adequate-length';
const thirdPasswordA = 'third-test-password-choice-a';
const thirdPasswordB = 'third-test-password-choice-b';
let app: INestApplication<App>;
let userId: string;

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

const change = (cookie: string, currentPassword: string, newPassword: string) =>
  request(app.getHttpServer())
    .post('/api/auth/change-password')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .send({ currentPassword, newPassword });

beforeAll(async () => {
  const passwordHash = await new PasswordHasher({ logN: 10 }).hash(
    firstPassword,
  );
  const row = await owner.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1, $1, $2) RETURNING id',
    [email, passwordHash],
  );
  userId = row.rows[0].id;
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.init();
});

afterAll(async () => {
  await app?.close();
  if (userId)
    await owner.query('DELETE FROM identity.users WHERE id = $1', [userId]);
  await owner.query(
    'DELETE FROM identity.sign_in_attempts WHERE subject_hash = $1',
    [createHash('sha256').update(email).digest('hex')],
  );
  await owner.end();
});

test('rolls back the new hash when session revocation fails', async () => {
  const cookie = cookieOf(await signIn(firstPassword).expect(200));
  const [{ password_hash: originalHash }] = (
    await owner.query<{ password_hash: string }>(
      'SELECT password_hash FROM identity.users WHERE id = $1',
      [userId],
    )
  ).rows;
  const triggerName = `test_change_password_${randomUUID().replaceAll('-', '')}`;
  await owner.query(`
    CREATE FUNCTION identity.${triggerName}() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'injected session revocation failure';
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
    await change(cookie, firstPassword, secondPassword).expect(500);
  } finally {
    await owner.query(
      `DROP TRIGGER IF EXISTS ${triggerName} ON identity.sessions`,
    );
    await owner.query(`DROP FUNCTION identity.${triggerName}()`);
  }

  const state = await owner.query<{ password_hash: string; sessions: string }>(
    `SELECT password_hash,
      (SELECT count(*) FROM identity.sessions WHERE user_id = $1)::text AS sessions
     FROM identity.users WHERE id = $1`,
    [userId],
  );
  expect(state.rows[0]).toEqual({ password_hash: originalHash, sessions: '1' });
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(200);
  await signIn(secondPassword).expect(401);
});

test('requires the current password and revokes every session with the change', async () => {
  const firstCookie = cookieOf(await signIn(firstPassword).expect(200));
  const secondCookie = cookieOf(await signIn(firstPassword).expect(200));

  await request(app.getHttpServer())
    .post('/api/auth/change-password')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ currentPassword: firstPassword, newPassword: secondPassword })
    .expect(401);
  await change(firstCookie, 'wrong-password', secondPassword).expect(401);
  await request(app.getHttpServer())
    .post('/api/auth/change-password')
    .set('Host', 'localhost:3000')
    .set('Origin', 'https://foreign.test')
    .set('Cookie', firstCookie)
    .send({ currentPassword: firstPassword, newPassword: secondPassword })
    .expect(403);
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', secondCookie)
    .expect(200);

  await signIn('wrong-password').expect(401);
  const changed = await change(
    firstCookie,
    firstPassword,
    secondPassword,
  ).expect(204);
  expect(changed.headers['cache-control']).toBe('no-store');
  expect(cookieOf(changed)).toContain('__Host-sid=;');
  const state = await owner.query<{ sessions: string; attempts: string }>(
    `SELECT
      (SELECT count(*) FROM identity.sessions WHERE user_id = $1)::text AS sessions,
      (SELECT count(*) FROM identity.sign_in_attempts WHERE subject_hash = $2)::text AS attempts`,
    [userId, createHash('sha256').update(email).digest('hex')],
  );
  expect(state.rows[0]).toEqual({ sessions: '0', attempts: '0' });
  for (const cookie of [firstCookie, secondCookie]) {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  }
  await signIn(firstPassword).expect(401);
  await signIn(secondPassword).expect(200);
});

test('only one concurrent change using the old hash can succeed', async () => {
  const firstCookie = cookieOf(await signIn(secondPassword).expect(200));
  const secondCookie = cookieOf(await signIn(secondPassword).expect(200));
  const responses = await Promise.all([
    change(firstCookie, secondPassword, thirdPasswordA),
    change(secondCookie, secondPassword, thirdPasswordB),
  ]);
  expect(responses.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
    204, 401,
  ]);
  const successfulPassword =
    responses[0].status === 204 ? thirdPasswordA : thirdPasswordB;
  const rejectedPassword =
    responses[0].status === 204 ? thirdPasswordB : thirdPasswordA;
  await signIn(secondPassword).expect(401);
  await signIn(rejectedPassword).expect(401);
  await signIn(successfulPassword).expect(200);
});
