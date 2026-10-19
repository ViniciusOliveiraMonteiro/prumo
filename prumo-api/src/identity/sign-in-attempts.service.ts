import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IdentityDatabase } from './identity.database.js';

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 10;

export function hashSignInSubject(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

@Injectable()
export class SignInAttemptsService {
  constructor(private readonly database: IdentityDatabase) {}

  async retryAfter(email: string): Promise<number | null> {
    const result = await this.database.db.execute<{ retry_after: number }>(sql`
      SELECT greatest(1, ceil(extract(epoch from
        window_started_at + interval '15 minutes' - now())))::integer AS retry_after
      FROM identity.sign_in_attempts
      WHERE subject_hash = ${hashSignInSubject(email)}
        AND attempts >= ${MAX_ATTEMPTS}
        AND window_started_at > now() - interval '15 minutes'
    `);
    return result.rows[0]?.retry_after ?? null;
  }

  async recordFailure(email: string): Promise<number | null> {
    await this.database.db.execute(sql`
      DELETE FROM identity.sign_in_attempts
      WHERE window_started_at < now() - interval '1 day'
    `);
    const result = await this.database.db.execute<{
      attempts: number;
      retry_after: number;
    }>(sql`
      INSERT INTO identity.sign_in_attempts AS current
        (subject_hash, window_started_at, attempts)
      VALUES (${hashSignInSubject(email)}, now(), 1)
      ON CONFLICT (subject_hash) DO UPDATE SET
        window_started_at = CASE
          WHEN current.window_started_at <= now() - interval '15 minutes'
          THEN now() ELSE current.window_started_at END,
        attempts = CASE
          WHEN current.window_started_at <= now() - interval '15 minutes'
          THEN 1 ELSE least(current.attempts + 1, ${MAX_ATTEMPTS + 1}) END
      RETURNING attempts,
        greatest(1, ceil(extract(epoch from
          window_started_at + interval '15 minutes' - now())))::integer AS retry_after
    `);
    const row = result.rows[0];
    return row.attempts > MAX_ATTEMPTS
      ? Math.min(WINDOW_SECONDS, row.retry_after)
      : null;
  }

  async clear(email: string): Promise<void> {
    await this.database.db.execute(sql`
      DELETE FROM identity.sign_in_attempts
      WHERE subject_hash = ${hashSignInSubject(email)}
    `);
  }
}
