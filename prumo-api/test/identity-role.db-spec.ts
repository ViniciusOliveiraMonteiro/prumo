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
      can_use_recovery_codes: boolean;
      can_count_recovery_attempts: boolean;
      can_write_credential_event: boolean;
      can_read_credential_events: boolean;
      can_read_email_change: boolean;
      can_prune_email_change: boolean;
      can_write_email_challenge: boolean;
      can_prune_email_challenge: boolean;
      can_update_email_outbox: boolean;
      can_count_email_issues: boolean;
      can_limit_email_password: boolean;
      can_write_email_event: boolean;
      can_read_email_events: boolean;
    }>(`
      SELECT current_user, r.rolsuper, r.rolbypassrls, r.rolcreaterole,
        has_schema_privilege(current_user, 'identity', 'CREATE') AS can_create,
        has_table_privilege(current_user, 'identity.users', 'SELECT') AS can_select,
        has_table_privilege(current_user, 'identity.sessions', 'INSERT') AS can_insert,
        has_table_privilege(current_user, 'identity.sign_in_attempts', 'INSERT') AS can_count_attempts,
        has_table_privilege(current_user, 'identity.sign_in_attempts', 'UPDATE') AS can_update_attempts,
        has_table_privilege(current_user, 'identity.sign_in_attempts', 'DELETE') AS can_prune_attempts,
        has_table_privilege(current_user, 'identity.recovery_codes', 'DELETE') AS can_use_recovery_codes,
        has_table_privilege(current_user, 'identity.recovery_attempts', 'INSERT') AS can_count_recovery_attempts,
        has_table_privilege(current_user, 'identity.credential_events', 'INSERT') AS can_write_credential_event,
        has_table_privilege(current_user, 'identity.credential_events', 'SELECT') AS can_read_credential_events
        ,has_table_privilege(current_user, 'identity.email_change_requests', 'SELECT') AS can_read_email_change
        ,has_table_privilege(current_user, 'identity.email_change_requests', 'DELETE') AS can_prune_email_change
        ,has_table_privilege(current_user, 'identity.email_challenges', 'INSERT') AS can_write_email_challenge
        ,has_table_privilege(current_user, 'identity.email_challenges', 'DELETE') AS can_prune_email_challenge
        ,has_table_privilege(current_user, 'identity.email_delivery_outbox', 'UPDATE') AS can_update_email_outbox
        ,has_table_privilege(current_user, 'identity.email_issue_attempts', 'INSERT') AS can_count_email_issues
        ,has_table_privilege(current_user, 'identity.email_current_password_attempts', 'UPDATE') AS can_limit_email_password
        ,has_table_privilege(current_user, 'identity.email_events', 'INSERT') AS can_write_email_event
        ,has_table_privilege(current_user, 'identity.email_events', 'SELECT') AS can_read_email_events
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
      can_use_recovery_codes: true,
      can_count_recovery_attempts: true,
      can_write_credential_event: true,
      can_read_credential_events: false,
      can_read_email_change: true,
      can_prune_email_change: true,
      can_write_email_challenge: true,
      can_prune_email_challenge: true,
      can_update_email_outbox: true,
      can_count_email_issues: true,
      can_limit_email_password: true,
      can_write_email_event: true,
      can_read_email_events: false,
    });
  } finally {
    await pool.end();
  }
});
