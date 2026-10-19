import { randomBytes, randomUUID } from 'node:crypto';
import {
  AuthenticationStorage,
  SessionService,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { config } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { IdentityDatabase } from '../src/identity/identity.database.js';
import { DrizzleSessionStore } from '../src/identity/drizzle-session.store.js';

config({ path: '../.env', quiet: true });
const ownerUrl = process.env.PRUMO_DATABASE_URL;
if (!ownerUrl) throw new Error('PRUMO_DATABASE_URL is required');
const owner = new pg.Pool({ connectionString: ownerUrl });
const email = `store-${randomUUID()}@prumo.test`;
let userId: string;
let database: IdentityDatabase;
let store: DrizzleSessionStore;
let storage: AuthenticationStorage;

function session(): SessionRecord {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: randomBytes(32).toString('base64url'),
    userId,
    createdAt: now,
    expiresAt: new Date('2026-02-01T00:00:00.000Z'),
    lastActiveAt: now,
  };
}

async function openStore(): Promise<{
  database: IdentityDatabase;
  store: DrizzleSessionStore;
  storage: AuthenticationStorage;
}> {
  const database = new IdentityDatabase();
  await database.onModuleInit();
  const storage = new AuthenticationStorage();
  const store = new DrizzleSessionStore(database, storage);
  return { database, store, storage };
}

beforeAll(async () => {
  const row = await owner.query<{ id: string }>(
    'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1, $1, $2) RETURNING id',
    [email, 'test-only-hash'],
  );
  userId = row.rows[0].id;
  ({ database, store, storage } = await openStore());
});

afterAll(async () => {
  await database?.onModuleDestroy();
  if (userId)
    await owner.query('DELETE FROM identity.users WHERE id = $1', [userId]);
  await owner.end();
});

test('round trips optional fields and revokes only the selected session', async () => {
  const first = {
    ...session(),
    mfa: 'verified' as const,
    metadata: { device: 'test' },
  };
  const second = session();
  await store.createSession(first);
  await store.createSession(second);
  expect(await store.getSession(first.id)).toEqual(first);
  expect(await store.getSession(second.id)).toEqual(second);
  expect(
    (await store.listUserSessions(userId)).map(({ id }) => id).sort(),
  ).toEqual([first.id, second.id].sort());
  expect(await store.deleteSession(first.id)).toBe(true);
  expect(await store.deleteSession(first.id)).toBe(false);
  expect(await store.getSession(second.id)).toEqual(second);
});

test('touch advances only forward and cannot restore a revoked session', async () => {
  const record = session();
  await store.createSession(record);
  const later = new Date('2026-01-01T00:01:00.000Z');
  await store.touchSession(record.id, later);
  await store.touchSession(record.id, record.lastActiveAt);
  expect((await store.getSession(record.id))?.lastActiveAt).toEqual(later);
  await store.deleteSession(record.id);
  await store.touchSession(record.id, later);
  expect(await store.getSession(record.id)).toBeUndefined();
});

test('concurrent deletes have one winner, and revocation survives a new connection', async () => {
  const record = session();
  await store.createSession(record);
  const results = await Promise.all(
    Array.from({ length: 6 }, () => store.deleteSession(record.id)),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  await database.onModuleDestroy();
  ({ database, store, storage } = await openStore());
  expect(await store.getSession(record.id)).toBeUndefined();
});

test('global revocation removes this user sessions with the application role', async () => {
  const first = session();
  const second = session();
  await store.createSession(first);
  await store.createSession(second);
  await store.deleteUserSessions(userId);
  expect(await store.listUserSessions(userId)).toEqual([]);
});

test('a rotation racing global revocation leaves no session', async () => {
  const service = new SessionService(storage, {
    session: { idleTtl: '1m', absoluteTtl: '5m', touchInterval: '10s' },
  });
  const issued = await service.create(userId);
  await Promise.all([
    service.rotate(issued.session),
    service.revokeAll(userId),
  ]);
  expect(await service.list(userId)).toEqual([]);
});

test('two concurrent rotations issue at most one replacement session', async () => {
  const service = new SessionService(storage, {
    session: { idleTtl: '1m', absoluteTtl: '5m', touchInterval: '10s' },
  });
  const issued = await service.create(userId);
  const results = await Promise.all([
    service.rotate(issued.session),
    service.rotate(issued.session),
  ]);
  expect(results.filter((result) => result !== null)).toHaveLength(1);
  expect(await service.list(userId)).toHaveLength(1);
});

test('a newer activity update survives validation that read an idle snapshot', async () => {
  let clock = Date.UTC(2026, 0, 1);
  let releaseRead!: () => void;
  let signalRead!: () => void;
  const readReleased = new Promise<void>((resolve) => (releaseRead = resolve));
  const readDone = new Promise<void>((resolve) => (signalRead = resolve));
  let pauseNextRead = false;
  const delayedStore: SessionStore = {
    getSession: async (id) => {
      const record = await store.getSession(id);
      if (pauseNextRead) {
        pauseNextRead = false;
        signalRead();
        await readReleased;
      }
      return record;
    },
    createSession: (record) => store.createSession(record),
    touchSession: (id, at) => store.touchSession(id, at),
    deleteSession: (id) => store.deleteSession(id),
    listUserSessions: (id) => store.listUserSessions(id),
    deleteUserSessions: (id) => store.deleteUserSessions(id),
  };
  const delayedStorage = new AuthenticationStorage();
  delayedStorage.registerSource({ sessions: delayedStore });
  const options = {
    idleTtl: '1m' as const,
    absoluteTtl: '1h' as const,
    touchInterval: 0,
  };
  const ahead = new SessionService(delayedStorage, {
    session: { ...options, now: () => clock },
  });
  const behind = new SessionService(delayedStorage, {
    session: { ...options, now: () => clock - 2_000 },
  });
  const issued = await ahead.create(userId);
  clock += 61_000;
  pauseNextRead = true;
  const staleValidation = ahead.validate(issued.token);
  await readDone;
  try {
    expect(await behind.validate(issued.token)).not.toBeNull();
  } finally {
    releaseRead();
  }
  expect(await staleValidation).toBeNull();
  clock += 1_000;
  expect(await ahead.validate(issued.token)).not.toBeNull();
});

test('revocation wins over activity update from an in-flight validation', async () => {
  let clock = Date.UTC(2026, 0, 1);
  let releaseTouch!: () => void;
  let signalTouch!: () => void;
  const touchReleased = new Promise<void>(
    (resolve) => (releaseTouch = resolve),
  );
  const touchStarted = new Promise<void>((resolve) => (signalTouch = resolve));
  const delayedStore: SessionStore = {
    getSession: (id) => store.getSession(id),
    createSession: (record) => store.createSession(record),
    touchSession: async (id, at) => {
      signalTouch();
      await touchReleased;
      await store.touchSession(id, at);
    },
    deleteSession: (id) => store.deleteSession(id),
    listUserSessions: (id) => store.listUserSessions(id),
    deleteUserSessions: (id) => store.deleteUserSessions(id),
  };
  const delayedStorage = new AuthenticationStorage();
  delayedStorage.registerSource({ sessions: delayedStore });
  const service = new SessionService(delayedStorage, {
    session: {
      idleTtl: '1m',
      absoluteTtl: '5m',
      touchInterval: '10s',
      now: () => clock,
    },
  });
  const issued = await service.create(userId);
  clock += 20_000;
  const inFlight = service.validate(issued.token);
  await touchStarted;
  try {
    await service.revokeAll(userId);
  } finally {
    releaseTouch();
  }
  expect(await inFlight).not.toBeNull();
  expect(await service.validate(issued.token)).toBeNull();
  expect(await store.listUserSessions(userId)).toEqual([]);
});
