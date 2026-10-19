import { createHash, randomBytes } from 'node:crypto';
import {
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { and, eq, sql } from 'drizzle-orm';
import { IdentityDatabase } from './identity.database.js';
import { IdentityUserRepository } from './identity-user.repository.js';
import { recoveryCodes, sessions, users } from './identity.schema.js';
import { hashSignInSubject } from './sign-in-attempts.service.js';

const CODE_COUNT = 8;
const MAX_FAILURES = 5;
const hashCode = (code: string): string =>
  createHash('sha256').update(code).digest('hex');
const generateCodes = (): string[] =>
  Array.from({ length: CODE_COUNT }, () =>
    randomBytes(16).toString('base64url'),
  );

@Injectable()
export class RecoveryCodesService {
  constructor(
    private readonly database: IdentityDatabase,
    private readonly users: IdentityUserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async issue(userId: string, currentPassword: string): Promise<string[]> {
    const credentials = await this.users.findActiveCredentialsById(userId);
    if (
      !credentials ||
      !(await this.hasher.verify(currentPassword, credentials.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const codes = generateCodes();
    await this.database.db.transaction(async (tx) => {
      const locked = await tx.execute<{ password_hash: string }>(sql`
        SELECT password_hash FROM identity.users
        WHERE id = ${userId} AND active = true FOR UPDATE
      `);
      if (locked.rows[0]?.password_hash !== credentials.passwordHash) {
        throw new UnauthorizedException('Invalid credentials');
      }
      await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
      await tx
        .insert(recoveryCodes)
        .values(codes.map((code) => ({ userId, codeHash: hashCode(code) })));
      await tx.execute(sql`
        INSERT INTO identity.credential_events (user_id, kind)
        VALUES (${userId}, 'recovery_codes_issued')
      `);
    });
    return codes;
  }

  async recover(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<string[]> {
    if ((await this.retryAfter(email)) !== null) {
      throw new HttpException(
        'Too many attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const replacementCodes = generateCodes();
    const succeeded = await this.database.db.transaction(async (tx) => {
      const found = await tx.execute<{ id: string }>(sql`
        SELECT id FROM identity.users
        WHERE email_normalized = ${email} AND active = true FOR UPDATE
      `);
      const userId = found.rows[0]?.id;
      if (!userId) return false;
      const consumed = await tx
        .delete(recoveryCodes)
        .where(
          and(
            eq(recoveryCodes.userId, userId),
            eq(recoveryCodes.codeHash, hashCode(code)),
          ),
        )
        .returning({ codeHash: recoveryCodes.codeHash });
      if (consumed.length !== 1) return false;
      const passwordHash = await this.hasher.hash(newPassword);
      await tx
        .update(users)
        .set({
          passwordHash,
          credentialVersion: sql`${users.credentialVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
      await tx.insert(recoveryCodes).values(
        replacementCodes.map((replacement) => ({
          userId,
          codeHash: hashCode(replacement),
        })),
      );
      await tx.execute(sql`
        DELETE FROM identity.sign_in_attempts
        WHERE subject_hash = ${hashSignInSubject(email)}
      `);
      await tx.execute(sql`
        DELETE FROM identity.recovery_attempts
        WHERE subject_hash = ${hashSignInSubject(email)}
      `);
      await tx.execute(sql`
        INSERT INTO identity.credential_events (user_id, kind)
        VALUES (${userId}, 'password_recovered')
      `);
      return true;
    });
    if (!succeeded) {
      await this.recordFailure(email);
      throw new UnauthorizedException('Invalid recovery code');
    }
    return replacementCodes;
  }

  private async retryAfter(email: string): Promise<number | null> {
    const result = await this.database.db.execute<{ retry_after: number }>(sql`
      SELECT greatest(1, ceil(extract(epoch from
        window_started_at + interval '15 minutes' - now())))::integer AS retry_after
      FROM identity.recovery_attempts
      WHERE subject_hash = ${hashSignInSubject(email)}
        AND attempts >= ${MAX_FAILURES}
        AND window_started_at > now() - interval '15 minutes'
    `);
    return result.rows[0]?.retry_after ?? null;
  }

  private async recordFailure(email: string): Promise<void> {
    await this.database.db.execute(sql`
      DELETE FROM identity.recovery_attempts
      WHERE window_started_at < now() - interval '1 day'
    `);
    await this.database.db.execute(sql`
      INSERT INTO identity.recovery_attempts AS current
        (subject_hash, window_started_at, attempts)
      VALUES (${hashSignInSubject(email)}, now(), 1)
      ON CONFLICT (subject_hash) DO UPDATE SET
        window_started_at = CASE
          WHEN current.window_started_at <= now() - interval '15 minutes'
          THEN now() ELSE current.window_started_at END,
        attempts = CASE
          WHEN current.window_started_at <= now() - interval '15 minutes'
          THEN 1 ELSE least(current.attempts + 1, ${MAX_FAILURES}) END
    `);
  }
}
