import { sql } from 'drizzle-orm';
import type { IdentityDatabase } from './identity.database.js';

export type PruneResult = {
  sessions: number;
  signInAttempts: number;
  recoveryAttempts: number;
};

export async function pruneExpiredIdentityData(
  database: IdentityDatabase,
): Promise<PruneResult> {
  return database.db.transaction(async (tx) => {
    const sessions = await tx.execute(sql`
      DELETE FROM identity.sessions WHERE expires_at < now()
    `);
    const signInAttempts = await tx.execute(sql`
      DELETE FROM identity.sign_in_attempts
      WHERE window_started_at < now() - interval '1 day'
    `);
    const recoveryAttempts = await tx.execute(sql`
      DELETE FROM identity.recovery_attempts
      WHERE window_started_at < now() - interval '1 day'
    `);
    return {
      sessions: sessions.rowCount ?? 0,
      signInAttempts: signInAttempts.rowCount ?? 0,
      recoveryAttempts: recoveryAttempts.rowCount ?? 0,
    };
  });
}
