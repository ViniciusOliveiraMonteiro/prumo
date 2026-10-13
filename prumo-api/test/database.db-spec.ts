import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';

config({ path: path.resolve(process.cwd(), '../.env'), quiet: true });

const connectionString = process.env.PRUMO_DATABASE_URL;
if (!connectionString) throw new Error('PRUMO_DATABASE_URL is required');

const suffix = process.pid.toString();
const schema = `prumo_lab_${suffix}`;
const role = `prumo_lab_app_${suffix}`;
const password = randomBytes(24).toString('hex');
const admin = new pg.Pool({ connectionString });
const appUrl = new URL(connectionString);
appUrl.username = role;
appUrl.password = password;
const app = new pg.Pool({ connectionString: appUrl.toString(), max: 2 });

beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
  await admin.query(`
    CREATE TABLE ${schema}.probe_records (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      household_id text NOT NULL,
      amount bigint NOT NULL
    );
    CREATE TABLE ${schema}.requests (key text PRIMARY KEY);
    CREATE TABLE ${schema}.versions (id integer PRIMARY KEY, version integer NOT NULL);
    CREATE TABLE ${schema}.targets (
      household_id text NOT NULL,
      id integer NOT NULL,
      PRIMARY KEY (household_id, id)
    );
    CREATE TABLE ${schema}.links (
      household_id text NOT NULL,
      target_id integer NOT NULL,
      FOREIGN KEY (household_id, target_id) REFERENCES ${schema}.targets (household_id, id)
    );
    INSERT INTO ${schema}.versions VALUES (1, 0);
    INSERT INTO ${schema}.targets VALUES ('A', 1), ('B', 2);
    ALTER TABLE ${schema}.probe_records ENABLE ROW LEVEL SECURITY;
    CREATE POLICY household_scope ON ${schema}.probe_records
      USING (household_id = current_setting('prumo.household_id', true))
      WITH CHECK (household_id = current_setting('prumo.household_id', true));
    GRANT USAGE ON SCHEMA ${schema} TO ${role};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role};
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role};
  `);
});

afterAll(async () => {
  await app.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.query(`DROP ROLE IF EXISTS ${role}`);
  await admin.end();
});

test('migration is recorded and repeatable', async () => {
  const result = await admin.query<{ name: string }>(
    "SELECT name FROM public.schema_migrations WHERE name = '0001_bootstrap.sql'",
  );
  expect(result.rows).toHaveLength(1);
});

test('Drizzle transaction rolls back every write on failure', async () => {
  const db = drizzle(app);
  await expect(
    db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('prumo.household_id', 'A', true)`);
      await tx.execute(
        sql`INSERT INTO ${sql.raw(`"${schema}"."probe_records"`)} (household_id, amount) VALUES ('A', 100)`,
      );
      throw new Error('second write failed');
    }),
  ).rejects.toThrow('second write failed');

  const rows = await admin.query<{ count: string }>(
    `SELECT count(*) FROM ${schema}.probe_records`,
  );
  expect(rows.rows[0].count).toBe('0');
});

test('ten concurrent requests with the same key create one row', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      app.query(
        `INSERT INTO ${schema}.requests (key) VALUES ($1) ON CONFLICT DO NOTHING`,
        ['same-key'],
      ),
    ),
  );
  expect(
    results.reduce((count, result) => count + (result.rowCount ?? 0), 0),
  ).toBe(1);
});

test('two revisions of the same version have one winner', async () => {
  const results = await Promise.all(
    Array.from({ length: 2 }, () =>
      app.query(
        `UPDATE ${schema}.versions SET version = version + 1 WHERE id = 1 AND version = 0`,
      ),
    ),
  );
  expect(
    results.reduce((count, result) => count + (result.rowCount ?? 0), 0),
  ).toBe(1);
});

test('application role cannot read or write another household and pool resets context', async () => {
  await admin.query(
    `INSERT INTO ${schema}.probe_records (household_id, amount) VALUES ('B', 900)`,
  );
  const client = await app.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('prumo.household_id', 'A', true)");
    const rows = await client.query(`SELECT id FROM ${schema}.probe_records`);
    expect(rows.rows).toHaveLength(0);
    const update = await client.query(
      `UPDATE ${schema}.probe_records SET amount = 1 WHERE household_id = 'B'`,
    );
    expect(update.rowCount).toBe(0);
    const deletion = await client.query(
      `DELETE FROM ${schema}.probe_records WHERE household_id = 'B'`,
    );
    expect(deletion.rowCount).toBe(0);
    await expect(
      client.query(
        `INSERT INTO ${schema}.probe_records (household_id, amount) VALUES ('B', 1)`,
      ),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
    const afterReuse = await client.query(
      `SELECT id FROM ${schema}.probe_records`,
    );
    expect(afterReuse.rows).toHaveLength(0);
  } finally {
    client.release();
  }
});

test('composite foreign key rejects a cross-household link', async () => {
  await expect(
    app.query(
      `INSERT INTO ${schema}.links (household_id, target_id) VALUES ('A', 2)`,
    ),
  ).rejects.toThrow();
});

test('bigint is read without losing precision', async () => {
  const amount = '9007199254740993';
  await admin.query(
    `INSERT INTO ${schema}.probe_records (household_id, amount) VALUES ('A', $1)`,
    [amount],
  );
  const client = await app.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('prumo.household_id', 'A', true)");
    const result = await client.query<{ amount: string }>(
      `SELECT amount FROM ${schema}.probe_records WHERE amount = $1`,
      [amount],
    );
    expect(result.rows[0].amount).toBe(amount);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
});
