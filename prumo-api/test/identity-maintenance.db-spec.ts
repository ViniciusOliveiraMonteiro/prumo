import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { config } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { IdentityDatabase } from '../src/identity/identity.database.js';
import { pruneExpiredIdentityData } from '../src/identity/prune-expired.js';

config({ path: '../.env', quiet: true });
const ownerUrl = process.env.PRUMO_DATABASE_URL;
if (!ownerUrl) throw new Error('PRUMO_DATABASE_URL is required');
const owner = new pg.Pool({ connectionString: ownerUrl });
const email = `prune-${randomUUID()}@prumo.test`;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const expiredId = randomBytes(32).toString('base64url');
const activeId = randomBytes(32).toString('base64url');
const oldSignIn = hash(`old-sign-in-${email}`);
const currentSignIn = hash(`current-sign-in-${email}`);
const oldRecovery = hash(`old-recovery-${email}`);
const currentRecovery = hash(`current-recovery-${email}`);
let userId: string;
let database: IdentityDatabase;

beforeAll(async () => {
  const row = await owner.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1, $1, $2) RETURNING id',
    [email, 'test-only-hash'],
  );
  userId = row.rows[0].id;
  await owner.query(
    `INSERT INTO identity.sessions(id, user_id, created_at, expires_at, last_active_at)
     VALUES ($1, $3, now() - interval '2 days', now() - interval '1 day', now() - interval '2 days'),
            ($2, $3, now(), now() + interval '1 day', now())`,
    [expiredId, activeId, userId],
  );
  for (const [table, stale, current] of [
    ['identity.sign_in_attempts', oldSignIn, currentSignIn],
    ['identity.recovery_attempts', oldRecovery, currentRecovery],
  ]) {
    await owner.query(
      `INSERT INTO ${table}(subject_hash, window_started_at, attempts)
       VALUES ($1, now() - interval '2 days', 1), ($2, now(), 1)`,
      [stale, current],
    );
  }
  database = new IdentityDatabase();
  await database.onModuleInit();
});

afterAll(async () => {
  await database?.onModuleDestroy();
  if (userId)
    await owner.query('DELETE FROM identity.users WHERE id = $1', [userId]);
  await owner.query(
    'DELETE FROM identity.sign_in_attempts WHERE subject_hash = ANY($1::text[])',
    [[oldSignIn, currentSignIn]],
  );
  await owner.query(
    'DELETE FROM identity.recovery_attempts WHERE subject_hash = ANY($1::text[])',
    [[oldRecovery, currentRecovery]],
  );
  await owner.end();
});

test('prunes expired identity rows with the application role and keeps live rows', async () => {
  const removed = await pruneExpiredIdentityData(database);
  expect(removed.sessions).toBeGreaterThanOrEqual(1);
  expect(removed.signInAttempts).toBeGreaterThanOrEqual(1);
  expect(removed.recoveryAttempts).toBeGreaterThanOrEqual(1);
  const sessions = await owner.query<{ id: string }>(
    'SELECT id FROM identity.sessions WHERE user_id = $1',
    [userId],
  );
  expect(sessions.rows.map(({ id }) => id)).toEqual([activeId]);
  for (const [table, stale, current] of [
    ['identity.sign_in_attempts', oldSignIn, currentSignIn],
    ['identity.recovery_attempts', oldRecovery, currentRecovery],
  ]) {
    const rows = await owner.query<{ subject_hash: string }>(
      `SELECT subject_hash FROM ${table} WHERE subject_hash = ANY($1::text[])`,
      [[stale, current]],
    );
    expect(rows.rows.map(({ subject_hash }) => subject_hash)).toEqual([
      current,
    ]);
  }
  expect(await pruneExpiredIdentityData(database)).toEqual({
    sessions: 0,
    signInAttempts: 0,
    recoveryAttempts: 0,
  });
});
