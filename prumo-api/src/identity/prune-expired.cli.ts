import { config } from 'dotenv';
import {
  assertApplicationDatabaseUrl,
  IdentityDatabase,
} from './identity.database.js';
import { pruneExpiredIdentityData } from './prune-expired.js';

config({ path: '../.env', quiet: true });

if (process.argv.length !== 2) {
  throw new Error('This command does not accept arguments');
}
const connectionString = process.env.PRUMO_APP_DATABASE_URL;
if (!connectionString) throw new Error('PRUMO_APP_DATABASE_URL is required');
assertApplicationDatabaseUrl(connectionString, true);

const database = new IdentityDatabase();
try {
  await database.onModuleInit();
  const result = await pruneExpiredIdentityData(database);
  process.stdout.write(
    `Removed ${result.sessions} expired sessions, ${result.signInAttempts} old sign-in counters, ${result.recoveryAttempts} old recovery counters, ${result.emailOutbox} expired email payloads, ${result.emailOutboxHistory} old email outbox rows, ${result.emailIssueAttempts} old email issue attempts, ${result.emailChallenges} expired email challenges and ${result.emailChanges} expired email changes.\n`,
  );
} finally {
  await database.onModuleDestroy();
}
