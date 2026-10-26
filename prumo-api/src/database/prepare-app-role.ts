import { config } from 'dotenv';
import pg from 'pg';

config({ path: '../.env', quiet: true });

const adminUrl = process.env.PRUMO_DATABASE_URL;
const appUrl = process.env.PRUMO_APP_DATABASE_URL;
if (!adminUrl || !appUrl) {
  throw new Error('PRUMO_DATABASE_URL and PRUMO_APP_DATABASE_URL are required');
}
const admin = new URL(adminUrl);
const app = new URL(appUrl);
if (
  admin.hostname !== '127.0.0.1' ||
  app.hostname !== '127.0.0.1' ||
  admin.pathname !== '/prumo_dev' ||
  app.pathname !== '/prumo_dev' ||
  admin.username !== 'prumo_migrator' ||
  app.username !== 'prumo_app' ||
  !app.password
) {
  throw new Error('This role setup only supports the local prumo_dev database');
}

const pool = new pg.Pool({ connectionString: adminUrl });
try {
  const exists = await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [
    'prumo_app',
  ]);
  if (exists.rowCount === 0) await pool.query('CREATE ROLE prumo_app LOGIN');
  const quoted = await pool.query<{ value: string }>(
    'SELECT quote_literal($1) AS value',
    [decodeURIComponent(app.password)],
  );
  await pool.query(
    `ALTER ROLE prumo_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${quoted.rows[0].value}`,
  );
  await pool.query('GRANT CONNECT ON DATABASE prumo_dev TO prumo_app');
  await pool.query('GRANT USAGE ON SCHEMA identity TO prumo_app');
  await pool.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON identity.users, identity.sessions TO prumo_app',
  );
  await pool.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON identity.sign_in_attempts TO prumo_app',
  );
  await pool.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON identity.recovery_codes, identity.recovery_attempts TO prumo_app',
  );
  await pool.query('GRANT INSERT ON identity.credential_events TO prumo_app');
  await pool.query(
    'REVOKE SELECT ON identity.credential_events FROM prumo_app',
  );
  await pool.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON identity.email_change_requests, identity.email_challenges TO prumo_app',
  );
  await pool.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON identity.email_delivery_outbox TO prumo_app',
  );
  await pool.query(
    'GRANT SELECT, INSERT, DELETE ON identity.email_issue_attempts TO prumo_app',
  );
  await pool.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON identity.email_current_password_attempts TO prumo_app',
  );
  await pool.query(
    'GRANT USAGE, SELECT ON SEQUENCE identity.email_issue_attempts_id_seq TO prumo_app',
  );
  await pool.query('GRANT INSERT ON identity.email_events TO prumo_app');
  await pool.query('REVOKE SELECT ON identity.email_events FROM prumo_app');
  await pool.query('GRANT USAGE ON SCHEMA household TO prumo_app');
  await pool.query(
    'GRANT SELECT, INSERT, UPDATE ON household.households TO prumo_app',
  );
  await pool.query(
    'GRANT SELECT, INSERT, UPDATE ON household.memberships TO prumo_app',
  );
  await pool.query('GRANT INSERT ON household.events TO prumo_app');
  await pool.query('REVOKE SELECT ON household.events FROM prumo_app');
  await pool.query(
    'GRANT SELECT, INSERT, UPDATE ON household.invitations TO prumo_app',
  );
  await pool.query(
    'GRANT SELECT, INSERT, DELETE ON household.invitation_requests TO prumo_app',
  );
  process.stdout.write('Local application role is ready.\n');
} finally {
  await pool.end();
}
