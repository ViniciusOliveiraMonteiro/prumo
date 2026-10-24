ALTER TABLE identity.email_delivery_outbox
  ADD COLUMN kind text NOT NULL DEFAULT 'challenge'
    CHECK (kind IN ('challenge', 'change_completed'));

CREATE TABLE identity.email_current_password_attempts (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 5)
);
