import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { and, eq, lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { afterAll, beforeAll, test } from 'vitest';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import type { SessionRecord, SessionStore } from '@nestjs/authentication';

config({ path: '../.env', quiet: true });
const connectionString = process.env.PRUMO_DATABASE_URL;
if (!connectionString) throw new Error('PRUMO_DATABASE_URL is required');

const schemaName = `prumo_auth_lab_${process.pid}_${randomBytes(3).toString('hex')}`;
const schema = pgSchema(schemaName);
const sessions = schema.table('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull(),
  mfa: text('mfa'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
});
const pool = new pg.Pool({ connectionString, max: 5 });
const db = drizzle(pool);

class DrizzleSessionLabStore implements SessionStore {
  private toRecord(row: typeof sessions.$inferSelect): SessionRecord {
    return {
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActiveAt: row.lastActiveAt,
      ...(row.mfa ? { mfa: row.mfa as SessionRecord['mfa'] } : {}),
      ...(row.metadata ? { metadata: row.metadata } : {}),
    };
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
    return row ? this.toRecord(row) : undefined;
  }

  async createSession(record: SessionRecord): Promise<void> {
    await db.insert(sessions).values({
      id: record.id,
      userId: record.userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      lastActiveAt: record.lastActiveAt,
      mfa: record.mfa,
      metadata: record.metadata,
    });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await db
      .update(sessions)
      .set({ lastActiveAt })
      .where(and(eq(sessions.id, id), lt(sessions.lastActiveAt, lastActiveAt)));
  }

  async deleteSession(id: string): Promise<boolean> {
    const deleted = await db
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning({ id: sessions.id });
    return deleted.length > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    return (
      await db.select().from(sessions).where(eq(sessions.userId, userId))
    ).map((row) => this.toRecord(row));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

beforeAll(async () => {
  await pool.query(`CREATE SCHEMA ${schemaName}`);
  await pool.query(`CREATE TABLE ${schemaName}.sessions (
    id text PRIMARY KEY, user_id text NOT NULL, created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL, last_active_at timestamptz NOT NULL,
    mfa text, metadata jsonb
  )`);
});

afterAll(async () => {
  await pool.query(`DROP SCHEMA ${schemaName} CASCADE`);
  await pool.end();
});

for (const testCase of authenticationStoreContract(
  async () => {
    await db.delete(sessions);
    return { sessions: new DrizzleSessionLabStore() };
  },
  { contracts: ['sessions'], concurrent: true },
)) {
  test(testCase.name, () => testCase.run());
}
