import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users } from './identity.schema.js';

export function assertApplicationDatabaseUrl(
  connectionString: string,
  localOnly = false,
): void {
  let url: URL;
  let parameters: { user: string; host: string; database: string };
  try {
    url = new URL(connectionString);
    parameters = (
      new pg.Client({ connectionString }) as pg.Client & {
        connectionParameters: typeof parameters;
      }
    ).connectionParameters;
  } catch {
    throw new Error('Invalid application database URL');
  }
  if (parameters.user !== 'prumo_app') {
    throw new Error('The API must use the prumo_app database role');
  }
  if (
    localOnly &&
    (url.search !== '' ||
      url.hash !== '' ||
      parameters.host !== '127.0.0.1' ||
      parameters.database !== 'prumo_dev' ||
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/prumo_dev')
  ) {
    throw new Error('Pruning only supports the local prumo_dev database');
  }
}

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
    assertApplicationDatabaseUrl(connectionString);
    this.pool = new pg.Pool({ connectionString });
    this.connection = drizzle(this.pool);
    await this.db.select({ id: users.id }).from(users).limit(1);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
