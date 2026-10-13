import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const migrationsPath = path.resolve(process.cwd(), 'migrations');
config({ path: path.resolve(process.cwd(), '../.env'), quiet: true });

export async function migrate(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(73183001)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        name text PRIMARY KEY,
        sha256 text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsPath))
      .filter((name) => /^\d+_[\w-]+\.sql$/.test(name))
      .sort();
    const applied = await client.query<{ name: string; sha256: string }>(
      'SELECT name, sha256 FROM public.schema_migrations',
    );
    const checksums = new Map(
      applied.rows.map(({ name, sha256 }) => [name, sha256]),
    );

    for (const name of files) {
      const sql = await readFile(path.join(migrationsPath, name), 'utf8');
      const sha256 = createHash('sha256').update(sql).digest('hex');
      const previous = checksums.get(name);
      if (previous && previous !== sha256)
        throw new Error(`Migration changed: ${name}`);
      if (previous) continue;

      await client.query(sql);
      await client.query(
        'INSERT INTO public.schema_migrations (name, sha256) VALUES ($1, $2)',
        [name, sha256],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const connectionString = process.env.PRUMO_DATABASE_URL;
  if (!connectionString) throw new Error('PRUMO_DATABASE_URL is required');
  await migrate(connectionString);
}
