import { config } from 'dotenv';
import pg from 'pg';
import { expect, test } from 'vitest';

config({ path: '../.env', quiet: true });
const connectionString = process.env.PRUMO_APP_DATABASE_URL;
if (!connectionString) throw new Error('PRUMO_APP_DATABASE_URL is required');

test('application role can use identity tables without owning schema or bypassing RLS', async () => {
  const pool = new pg.Pool({ connectionString });
  try {
    const result = await pool.query<{
      current_user: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      can_create: boolean;
      can_select: boolean;
      can_insert: boolean;
      can_count_attempts: boolean;
      can_update_attempts: boolean;
      can_prune_attempts: boolean;
    }>(`
      SELECT current_user, r.rolsuper, r.rolbypassrls, r.rolcreaterole,
        has_schema_privilege(current_user, 'identity', 'CREATE') AS can_create,
        has_table_privilege(current_user, 'identity.users', 'SELECT') AS can_select,
        has_table_privilege(current_user, 'identity.sessions', 'INSERT') AS can_insert,
        has_table_privilege(current_user, 'identity.sign_in_attempts', 'INSERT') AS can_count_attempts,
        has_table_privilege(current_user, 'identity.sign_in_attempts', 'UPDATE') AS can_update_attempts,
        has_table_privilege(current_user, 'identity.sign_in_attempts', 'DELETE') AS can_prune_attempts
      FROM pg_roles r WHERE r.rolname = current_user
    `);
    expect(result.rows[0]).toEqual({
      current_user: 'prumo_app',
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
      can_create: false,
      can_select: true,
      can_insert: true,
      can_count_attempts: true,
      can_update_attempts: true,
      can_prune_attempts: true,
    });
  } finally {
    await pool.end();
  }
});
