ALTER TABLE identity.sessions DROP CONSTRAINT sessions_id_hash;
ALTER TABLE identity.sessions ADD CONSTRAINT sessions_id_hash
  CHECK (id ~ '^[A-Za-z0-9_-]{43}$');
