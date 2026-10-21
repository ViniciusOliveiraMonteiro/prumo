CREATE SCHEMA household;

CREATE TABLE household.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE household.memberships (
  household_id uuid NOT NULL REFERENCES household.households(id),
  user_id uuid NOT NULL REFERENCES identity.users(id),
  role text NOT NULL CHECK (role IN ('OWNER', 'MEMBER', 'VIEWER')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);
CREATE INDEX memberships_user_active_idx ON household.memberships(user_id, household_id) WHERE active;

CREATE TABLE household.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES household.households(id),
  actor_user_id uuid NOT NULL REFERENCES identity.users(id),
  kind text NOT NULL CHECK (kind IN ('created', 'renamed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (household_id, actor_user_id)
    REFERENCES household.memberships(household_id, user_id)
);
