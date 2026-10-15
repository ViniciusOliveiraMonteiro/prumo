import { config } from 'dotenv';
import { PasswordHasher } from '@nestjs/authentication';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import pg from 'pg';
import { users } from './identity.schema.js';
import { normalizeEmail } from './normalize-email.js';

config({ path: '../.env', quiet: true });

const email = process.argv[2]?.trim();
const emailNormalized = normalizeEmail(email);
const connectionString = process.env.PRUMO_DATABASE_URL;
if (!email || !emailNormalized) {
  throw new Error('Provide one valid email address as the only argument');
}
if (!connectionString) throw new Error('PRUMO_DATABASE_URL is required');
const databaseUrl = new URL(connectionString);
if (
  databaseUrl.username !== 'prumo_migrator' ||
  databaseUrl.hostname !== '127.0.0.1' ||
  databaseUrl.pathname !== '/prumo_dev'
) {
  throw new Error('Provisioning only supports the local prumo_dev database');
}
if (!process.stdin.isTTY)
  throw new Error('A terminal is required to enter the password');

const muted = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
const prompt = createInterface({
  input: process.stdin,
  output: muted,
  terminal: true,
});
let password: string;
try {
  process.stdout.write('Password: ');
  password = await prompt.question('');
  process.stdout.write('\nConfirm password: ');
  const confirmation = await prompt.question('');
  process.stdout.write('\n');
  if (password !== confirmation) throw new Error('Passwords do not match');
  if (password.length < 12 || password.length > 1024) {
    throw new Error('Password must be 12–1024 characters');
  }
} finally {
  prompt.close();
}

const hash = await new PasswordHasher().hash(password);
const pool = new pg.Pool({ connectionString });
try {
  await drizzle(pool).insert(users).values({
    email,
    emailNormalized,
    passwordHash: hash,
  });
  process.stdout.write('User provisioned.\n');
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === '23505') {
    throw new Error('User already exists');
  }
  throw new Error('Could not provision user');
} finally {
  await pool.end();
}
