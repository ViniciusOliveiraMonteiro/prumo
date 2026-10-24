import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  integer,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const identity = pgSchema('identity');
const at = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

export const users = identity.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    emailNormalized: text('email_normalized').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    credentialVersion: integer('credential_version').notNull().default(0),
    emailVersion: integer('email_version').notNull().default(1),
    verifiedEmailVersion: integer('verified_email_version'),
    active: boolean('active').notNull().default(true),
    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'users_email_normalized',
      sql`${table.emailNormalized} = lower(btrim(${table.email}))`,
    ),
  ],
);

export const sessions = identity.table(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: at('created_at').notNull(),
    expiresAt: at('expires_at').notNull(),
    lastActiveAt: at('last_active_at').notNull(),
    mfa: text('mfa', { enum: ['pending', 'verified'] }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
    check('sessions_id_hash', sql`${table.id} ~ '^[A-Za-z0-9_-]{43}$'`),
    check('sessions_mfa_check', sql`${table.mfa} IN ('pending', 'verified')`),
  ],
);

export const recoveryCodes = identity.table(
  'recovery_codes',
  {
    codeHash: text('code_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (table) => [index('recovery_codes_user_id_idx').on(table.userId)],
);
