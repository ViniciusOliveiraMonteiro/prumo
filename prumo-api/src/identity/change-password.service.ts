import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { and, eq, sql } from 'drizzle-orm';
import { IdentityDatabase } from './identity.database.js';
import { IdentityUserRepository } from './identity-user.repository.js';
import { recoveryCodes, sessions, users } from './identity.schema.js';
import { hashSignInSubject } from './sign-in-attempts.service.js';

@Injectable()
export class ChangePasswordService {
  constructor(
    private readonly database: IdentityDatabase,
    private readonly users: IdentityUserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async change(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const credentials = await this.users.findActiveCredentialsById(userId);
    if (
      !credentials ||
      !(await this.hasher.verify(currentPassword, credentials.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordHash = await this.hasher.hash(newPassword);
    await this.database.db.transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set({
          passwordHash,
          credentialVersion: sql`${users.credentialVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(users.id, userId),
            eq(users.active, true),
            eq(users.passwordHash, credentials.passwordHash),
          ),
        )
        .returning({ id: users.id });
      if (updated.length !== 1) {
        throw new UnauthorizedException('Invalid credentials');
      }
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
      await tx.execute(sql`
        UPDATE identity.email_change_requests SET status = 'cancelled'
        WHERE user_id = ${userId} AND status = 'pending'
      `);
      await tx.execute(sql`
        UPDATE identity.email_challenges SET status = 'cancelled'
        WHERE user_id = ${userId} AND status = 'pending'
      `);
      await tx.execute(sql`
        DELETE FROM identity.sign_in_attempts
        WHERE subject_hash = ${hashSignInSubject(credentials.emailNormalized)}
      `);
    });
  }
}
