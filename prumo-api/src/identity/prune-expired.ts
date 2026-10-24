import { sql } from 'drizzle-orm';
import type { IdentityDatabase } from './identity.database.js';

export type PruneResult = {
  sessions: number;
  signInAttempts: number;
  recoveryAttempts: number;
  emailOutbox: number;
  emailChallenges: number;
  emailChanges: number;
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
    const emailOutbox = await tx.execute(sql`
      UPDATE identity.email_delivery_outbox
      SET status = 'discarded', payload_ciphertext = NULL,
        payload_iv = NULL, payload_tag = NULL
      WHERE status = 'pending' AND expires_at <= now()
    `);
    const emailChallenges = await tx.execute(sql`
      DELETE FROM identity.email_challenges WHERE expires_at <= now()
    `);
    const emailChanges = await tx.execute(sql`
      DELETE FROM identity.email_change_requests WHERE expires_at <= now()
    `);
    return {
      sessions: sessions.rowCount ?? 0,
      signInAttempts: signInAttempts.rowCount ?? 0,
      recoveryAttempts: recoveryAttempts.rowCount ?? 0,
      emailOutbox: emailOutbox.rowCount ?? 0,
      emailChallenges: emailChallenges.rowCount ?? 0,
      emailChanges: emailChanges.rowCount ?? 0,
    };
  });
}
