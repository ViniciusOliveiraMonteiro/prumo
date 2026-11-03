CREATE SCHEMA finance;

CREATE TABLE finance.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES household.households(id),
  created_by_user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120 AND name = btrim(name)),
  currency text NOT NULL CHECK (currency = 'BRL'),
  opening_date date NOT NULL,
  opening_balance_cents bigint NOT NULL
    CHECK (opening_balance_cents BETWEEN -9007199254740991 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, id),
  FOREIGN KEY (household_id, created_by_user_id)
    REFERENCES household.memberships(household_id, user_id)
);
CREATE INDEX accounts_household_created_idx
  ON finance.accounts(household_id, created_at, id);

CREATE TABLE finance.account_requests (
  household_id uuid NOT NULL REFERENCES household.households(id),
  operation text NOT NULL CHECK (operation = 'account:create'),
  request_key uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  request_payload jsonb NOT NULL,
  account_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, operation, request_key),
  FOREIGN KEY (household_id, actor_user_id)
    REFERENCES household.memberships(household_id, user_id),
  FOREIGN KEY (household_id, account_id)
    REFERENCES finance.accounts(household_id, id)
);
