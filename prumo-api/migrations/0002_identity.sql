CREATE SCHEMA identity;

CREATE TABLE identity.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email_normalized = lower(btrim(email)))
);

CREATE TABLE identity.sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_active_at timestamptz NOT NULL,
  mfa text CHECK (mfa IN ('pending', 'verified')),
  metadata jsonb,
  CONSTRAINT sessions_id_hash CHECK (id ~ '^[0-9a-f]{64}$')
);

CREATE INDEX sessions_user_id_idx ON identity.sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON identity.sessions(expires_at);
