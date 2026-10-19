import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { IdentityDatabase } from './identity.database.js';
import { users } from './identity.schema.js';

export interface IdentityUser {
  id: string;
  email: string;
}

@Injectable()
export class IdentityUserRepository {
  constructor(private readonly database: IdentityDatabase) {}

  async findActiveById(
    id: string,
  ): Promise<{ user: IdentityUser; credentialVersion: number } | null> {
    const [row] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        credentialVersion: users.credentialVersion,
      })
      .from(users)
      .where(and(eq(users.id, id), eq(users.active, true)));
    return row
      ? {
          user: { id: row.id, email: row.email },
          credentialVersion: row.credentialVersion,
        }
      : null;
  }

  async findCredentials(email: string): Promise<{
    user: IdentityUser;
    passwordHash: string;
    credentialVersion: number;
  } | null> {
    const [row] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        credentialVersion: users.credentialVersion,
      })
      .from(users)
      .where(and(eq(users.emailNormalized, email), eq(users.active, true)));
    return row
      ? {
          user: { id: row.id, email: row.email },
          passwordHash: row.passwordHash,
          credentialVersion: row.credentialVersion,
        }
      : null;
  }

  async findActiveCredentialsById(
    id: string,
  ): Promise<{ passwordHash: string; emailNormalized: string } | null> {
    const [row] = await this.database.db
      .select({
        passwordHash: users.passwordHash,
        emailNormalized: users.emailNormalized,
      })
      .from(users)
      .where(and(eq(users.id, id), eq(users.active, true)));
    return row ?? null;
  }
}
