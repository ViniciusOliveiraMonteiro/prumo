CREATE TABLE identity.sign_in_attempts (
  subject_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);

CREATE INDEX sign_in_attempts_window_started_at_idx
  ON identity.sign_in_attempts(window_started_at);
