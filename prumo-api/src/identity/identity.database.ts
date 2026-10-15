import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users } from './identity.schema.js';

@Injectable()
export class IdentityDatabase implements OnModuleInit, OnModuleDestroy {
  private pool?: pg.Pool;
  private connection?: ReturnType<typeof drizzle>;

  get db(): ReturnType<typeof drizzle> {
    if (!this.connection)
      throw new Error('Identity database is not initialized');
    return this.connection;
  }

  async onModuleInit(): Promise<void> {
    const connectionString = process.env.PRUMO_APP_DATABASE_URL;
    if (!connectionString)
      throw new Error('PRUMO_APP_DATABASE_URL is required');
    const url = new URL(connectionString);
    if (url.username !== 'prumo_app') {
      throw new Error('The API must use the prumo_app database role');
    }
    this.pool = new pg.Pool({ connectionString });
    this.connection = drizzle(this.pool);
    await this.db.select({ id: users.id }).from(users).limit(1);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
