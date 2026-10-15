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

  async findActiveById(id: string): Promise<IdentityUser | null> {
    const [row] = await this.database.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.id, id), eq(users.active, true)));
    return row ?? null;
  }

  async findCredentials(
    email: string,
  ): Promise<{ user: IdentityUser; passwordHash: string } | null> {
    const [row] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(and(eq(users.emailNormalized, email), eq(users.active, true)));
    return row
      ? {
          user: { id: row.id, email: row.email },
          passwordHash: row.passwordHash,
        }
      : null;
  }
}
