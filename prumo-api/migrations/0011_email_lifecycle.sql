ALTER TABLE identity.users
  ADD COLUMN email_version integer NOT NULL DEFAULT 1,
  ADD COLUMN verified_email_version integer,
  ADD CONSTRAINT users_email_version_positive CHECK (email_version > 0),
  ADD CONSTRAINT users_verified_email_version CHECK (
    verified_email_version IS NULL OR verified_email_version = email_version
  );

CREATE TABLE identity.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  old_email_normalized text NOT NULL,
  new_email_normalized text NOT NULL,
  from_email_version integer NOT NULL,
  from_credential_version integer NOT NULL,
  requires_old_proof boolean NOT NULL,
  eligible boolean NOT NULL DEFAULT true,
  status text NOT NULL CHECK (status IN ('pending', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (old_email_normalized <> new_email_normalized)
);
CREATE UNIQUE INDEX email_change_one_pending_idx
  ON identity.email_change_requests(user_id) WHERE status = 'pending';
CREATE INDEX email_change_user_idx ON identity.email_change_requests(user_id);

CREATE TABLE identity.email_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES identity.email_change_requests(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_current', 'change_old', 'change_new')),
  email_normalized text NOT NULL,
  email_version integer NOT NULL,
  credential_version integer NOT NULL,
  code_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  status text NOT NULL CHECK (status IN ('pending', 'consumed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK ((purpose = 'verify_current') = (request_id IS NULL)),
  CHECK (code_hash ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX email_verify_one_pending_idx
  ON identity.email_challenges(user_id)
  WHERE purpose = 'verify_current' AND status = 'pending';
CREATE UNIQUE INDEX email_change_challenge_one_pending_idx
  ON identity.email_challenges(request_id, purpose)
  WHERE request_id IS NOT NULL AND status = 'pending';
CREATE INDEX email_challenges_user_idx ON identity.email_challenges(user_id);

CREATE TABLE identity.email_issue_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_current', 'change_email')),
  admitted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_issue_window_idx
  ON identity.email_issue_attempts(user_id, purpose, created_at DESC);

CREATE TABLE identity.email_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES identity.email_challenges(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  payload_ciphertext bytea,
  payload_iv bytea,
  payload_tag bytea,
  key_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'captured', 'discarded')),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK ((status = 'pending') = (payload_ciphertext IS NOT NULL))
);
CREATE INDEX email_outbox_pending_idx
  ON identity.email_delivery_outbox(next_attempt_at) WHERE status = 'pending';

CREATE TABLE identity.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('verification_requested', 'email_verified', 'change_requested', 'email_changed', 'change_cancelled')),
  request_id uuid,
  challenge_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_events_user_idx ON identity.email_events(user_id);
