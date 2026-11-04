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
const suffix = randomUUID();
const knownEmail = `limit-known-${suffix}@prumo.test`;
const unknownEmail = `limit-unknown-${suffix}@prumo.test`;
const parallelEmail = `limit-parallel-${suffix}@prumo.test`;
const cleanupEmail = `limit-cleanup-${suffix}@prumo.test`;
const password = 'test-password-with-adequate-length';
let app: INestApplication<App>;
let userId: string;

const hash = (email: string) =>
  createHash('sha256').update(email).digest('hex');
const signIn = (email: string, passwordAttempt: string) =>
  request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password: passwordAttempt });

beforeAll(async () => {
  const passwordHash = await new PasswordHasher({ logN: 10 }).hash(password);
  const row = await owner.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1, $1, $2) RETURNING id',
    [knownEmail, passwordHash],
  );
  userId = row.rows[0].id;
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureHttp(app);
  await app.listen(0);
});

afterAll(async () => {
  await app?.close();
  if (userId)
    await owner.query('DELETE FROM identity.users WHERE id = $1', [userId]);
  await owner.query(
    'DELETE FROM identity.sign_in_attempts WHERE subject_hash = ANY($1::text[])',
    [[knownEmail, unknownEmail, parallelEmail, cleanupEmail].map(hash)],
  );
  await owner.end();
});

test('limits known and unknown accounts with the same response', async () => {
  for (const email of [knownEmail, unknownEmail]) {
    for (let index = 0; index < 10; index++) {
      const response = await signIn(email, 'wrong-password');
      expect(response.status).toBe(401);
    }
    const blocked = await signIn(email, password);
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toMatch(/^\d+$/);
    expect(blocked.headers['cache-control']).toBe('no-store');
  }
}, 15_000);

test('a new window permits login and success clears prior failures', async () => {
  await owner.query(
    "UPDATE identity.sign_in_attempts SET window_started_at = now() - interval '16 minutes' WHERE subject_hash = $1",
    [hash(knownEmail)],
  );
  const response = await signIn(knownEmail, password);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ id: userId, email: knownEmail });
  const cleared = await owner.query(
    'SELECT attempts FROM identity.sign_in_attempts WHERE subject_hash = $1',
    [hash(knownEmail)],
  );
  expect(cleared.rowCount).toBe(0);

  await signIn(knownEmail, 'wrong-password').expect(401);
  const restarted = await owner.query<{ attempts: number }>(
    'SELECT attempts FROM identity.sign_in_attempts WHERE subject_hash = $1',
    [hash(knownEmail)],
  );
  expect(restarted.rows[0]?.attempts).toBe(1);
  await signIn(knownEmail, password).expect(200);
});

test('a login removes attempt counters older than one day', async () => {
  const staleHash = hash(`limit-stale-${suffix}@prumo.test`);
  await owner.query(
    "INSERT INTO identity.sign_in_attempts(subject_hash, window_started_at, attempts) VALUES ($1, now() - interval '2 days', 1)",
    [staleHash],
  );
  await signIn(cleanupEmail, 'wrong-password').expect(401);
  const result = await owner.query(
    'SELECT 1 FROM identity.sign_in_attempts WHERE subject_hash = $1',
    [staleHash],
  );
  expect(result.rowCount).toBe(0);
});

test('concurrent requests share one atomic budget', async () => {
  const responses = await Promise.all(
    Array.from({ length: 20 }, () => signIn(parallelEmail, 'wrong-password')),
  );
  expect(responses.filter(({ status }) => status === 401)).toHaveLength(10);
  expect(responses.filter(({ status }) => status === 429)).toHaveLength(10);
}, 20_000);
