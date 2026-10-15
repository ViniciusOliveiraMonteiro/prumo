import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { and, eq, lt } from 'drizzle-orm';
import { IdentityDatabase } from './identity.database.js';
import { sessions } from './identity.schema.js';

@Injectable()
export class DrizzleSessionStore implements SessionStore {
  constructor(
    private readonly database: IdentityDatabase,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this });
  }

  private toRecord(row: typeof sessions.$inferSelect): SessionRecord {
    return {
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActiveAt: row.lastActiveAt,
      ...(row.mfa ? { mfa: row.mfa } : {}),
      ...(row.metadata ? { metadata: row.metadata } : {}),
    };
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const [row] = await this.database.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id));
    return row ? this.toRecord(row) : undefined;
  }

  async createSession(record: SessionRecord): Promise<void> {
    await this.database.db.insert(sessions).values({
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
    await this.database.db
      .update(sessions)
      .set({ lastActiveAt })
      .where(and(eq(sessions.id, id), lt(sessions.lastActiveAt, lastActiveAt)));
  }

  async deleteSession(id: string): Promise<boolean> {
    const rows = await this.database.db
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning({ id: sessions.id });
    return rows.length > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    return (
      await this.database.db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, userId))
    ).map((row) => this.toRecord(row));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.database.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}
