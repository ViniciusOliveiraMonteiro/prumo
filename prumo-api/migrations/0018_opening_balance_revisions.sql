ALTER TABLE finance.accounts
  ADD COLUMN opening_version integer NOT NULL DEFAULT 1
  CHECK (opening_version >= 1);

CREATE TABLE finance.opening_balance_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  account_id uuid NOT NULL,
  previous_version integer NOT NULL CHECK (previous_version >= 1),
  version integer NOT NULL CHECK (version = previous_version + 1),
  opening_date date NOT NULL,
  previous_balance_cents bigint NOT NULL,
  opening_balance_cents bigint NOT NULL
    CHECK (opening_balance_cents BETWEEN -9007199254740991 AND 9007199254740991),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500 AND reason = btrim(reason)),
  actor_user_id uuid NOT NULL,
  revised_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (household_id, account_id, version),
  FOREIGN KEY (household_id, account_id) REFERENCES finance.accounts(household_id, id),
  FOREIGN KEY (household_id, actor_user_id) REFERENCES household.memberships(household_id, user_id)
);

CREATE TABLE finance.opening_balance_revision_requests (
  household_id uuid NOT NULL,
  operation text NOT NULL DEFAULT 'account:opening-balance:revise'
    CHECK (operation = 'account:opening-balance:revise'),
  request_key uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  request_payload jsonb NOT NULL,
  revision_id uuid NOT NULL REFERENCES finance.opening_balance_revisions(id),
  response jsonb NOT NULL,
  PRIMARY KEY (household_id, operation, request_key),
  FOREIGN KEY (household_id, account_id) REFERENCES finance.accounts(household_id, id),
  FOREIGN KEY (household_id, actor_user_id) REFERENCES household.memberships(household_id, user_id)
);
