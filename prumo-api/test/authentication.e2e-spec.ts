import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import pg from 'pg';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http/configure-http.js';

config({ path: '../.env', quiet: true });
const connectionString = process.env.PRUMO_DATABASE_URL;
if (!connectionString) throw new Error('PRUMO_DATABASE_URL is required');
const admin = new pg.Pool({ connectionString });
const email = `session-${randomUUID()}@prumo.test`;
const password = 'a-test-password-with-adequate-length';
let userId: string;
let app: INestApplication<App>;

beforeAll(async () => {
  const passwordHash = await new PasswordHasher({ logN: 10 }).hash(password);
  const inserted = await admin.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [email, email, passwordHash],
  );
  userId = inserted.rows[0].id;
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
    await admin.query('DELETE FROM identity.users WHERE id = $1', [userId]);
  await admin.end();
});

test('signs in with a host-only cookie and denies the session after sign-out', async () => {
  const signedIn = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password })
    .expect(200);
  expect(signedIn.body).toEqual({ id: userId, email });
  expect(signedIn.headers['cache-control']).toBe('no-store');
  const setCookie = signedIn.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  expect(cookie).toContain('__Host-sid=');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).toContain('SameSite=Lax');
  expect(cookie).not.toContain('Domain=');

  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(200)
    .expect({ id: userId, email });

  const forbiddenSignOut = await request(app.getHttpServer())
    .post('/api/auth/sign-out')
    .set('Host', 'localhost:3000')
    .set('Origin', 'https://foreign.test')
    .set('Cookie', cookie)
    .expect(403);
  expect(forbiddenSignOut.headers['cache-control']).toBe('no-store');

  await request(app.getHttpServer())
    .post('/api/auth/sign-out')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .expect(204);

  const revoked = await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
  expect(revoked.headers['cache-control']).toBe('no-store');
});

test('rejects foreign origins and wrong credentials', async () => {
  const forbidden = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'https://foreign.test')
    .send({ email, password })
    .expect(403);
  expect(forbidden.headers['cache-control']).toBe('no-store');
  const invalid = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password: 123 })
    .expect(400);
  expect(invalid.headers['cache-control']).toBe('no-store');
  const unauthorized = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password: 'wrong-password' })
    .expect(401);
  expect(unauthorized.headers['cache-control']).toBe('no-store');
  const anonymous = await request(app.getHttpServer())
    .get('/api/auth/me')
    .expect(401);
  expect(anonymous.headers['cache-control']).toBe('no-store');
});

test('rejects an expired cookie even while its row remains in the database', async () => {
  const signedIn = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password })
    .expect(200);
  const setCookie = signedIn.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  await admin.query(
    "UPDATE identity.sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1",
    [userId],
  );
  const expired = await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
  expect(expired.headers['cache-control']).toBe('no-store');
});

test('sign-out-all revokes another session of the same user', async () => {
  const signIn = () =>
    request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .set('Host', 'localhost:3000')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password })
      .expect(200);
  const first = await signIn();
  const second = await signIn();
  const cookieOf = (response: typeof first): string => {
    const value = response.headers['set-cookie'];
    return Array.isArray(value) ? value[0] : value;
  };
  const firstCookie = cookieOf(first);
  const secondCookie = cookieOf(second);
  await request(app.getHttpServer())
    .post('/api/auth/sign-out-all')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', firstCookie)
    .expect(204);
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', firstCookie)
    .expect(401);
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', secondCookie)
    .expect(401);
});

test('rejects a previously valid session when the user is deactivated', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .set('Host', 'localhost:3000')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password })
    .expect(200);
  const setCookie = response.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  await admin.query('UPDATE identity.users SET active = false WHERE id = $1', [
    userId,
  ]);
  await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
});
