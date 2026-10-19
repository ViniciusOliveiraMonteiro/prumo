ALTER TABLE identity.users
  ADD COLUMN credential_version integer NOT NULL DEFAULT 0;

CREATE TABLE identity.recovery_codes (
  code_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recovery_codes_user_id_idx ON identity.recovery_codes(user_id);

CREATE TABLE identity.recovery_attempts (
  subject_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);
CREATE INDEX recovery_attempts_window_started_at_idx
  ON identity.recovery_attempts(window_started_at);

CREATE TABLE identity.credential_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('recovery_codes_issued', 'password_recovered')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credential_events_user_id_idx ON identity.credential_events(user_id);
