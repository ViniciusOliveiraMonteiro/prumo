CREATE TABLE finance.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES household.households(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80 AND name = btrim(name)),
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, id),
  FOREIGN KEY (household_id, created_by_user_id) REFERENCES household.memberships(household_id, user_id)
);
CREATE TABLE finance.category_requests (
  household_id uuid NOT NULL REFERENCES household.households(id),
  request_key uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  request_payload jsonb NOT NULL,
  category_id uuid NOT NULL,
  response jsonb NOT NULL,
  PRIMARY KEY (household_id, request_key),
  FOREIGN KEY (household_id, actor_user_id) REFERENCES household.memberships(household_id, user_id),
  FOREIGN KEY (household_id, category_id) REFERENCES finance.expense_categories(household_id, id)
);
ALTER TABLE finance.events DROP CONSTRAINT events_type_check;
ALTER TABLE finance.events ADD CONSTRAINT events_type_check CHECK (type IN ('RECEIVED_INCOME', 'DIRECT_EXPENSE'));
ALTER TABLE finance.events ADD CONSTRAINT events_household_id_type_unique UNIQUE (household_id, id, type);

ALTER TABLE finance.event_versions ADD COLUMN event_type text NOT NULL DEFAULT 'RECEIVED_INCOME';
ALTER TABLE finance.event_versions ADD COLUMN category_id uuid;
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_category_type_check CHECK (
  (event_type = 'RECEIVED_INCOME' AND category_id IS NULL) OR
  (event_type = 'DIRECT_EXPENSE' AND category_id IS NOT NULL)
);
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_event_type_fk
  FOREIGN KEY (household_id, event_id, event_type) REFERENCES finance.events(household_id, id, type);
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_category_fk
  FOREIGN KEY (household_id, category_id) REFERENCES finance.expense_categories(household_id, id);
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_movement_magnitude_unique
  UNIQUE (household_id, event_id, version, movement_id, account_id, amount_cents, effective_date, state, event_type);

DO $$
DECLARE old_link text;
BEGIN
  SELECT conname INTO old_link FROM pg_constraint
  WHERE conrelid = 'finance.movements'::regclass AND contype = 'f';
  IF old_link IS NULL THEN RAISE EXCEPTION 'Expected movement-to-version foreign key'; END IF;
  EXECUTE format('ALTER TABLE finance.movements DROP CONSTRAINT %I', old_link);
END $$;
ALTER TABLE finance.movements DROP CONSTRAINT movements_amount_cents_check;
ALTER TABLE finance.movements ADD COLUMN event_type text NOT NULL DEFAULT 'RECEIVED_INCOME';
ALTER TABLE finance.movements ADD COLUMN magnitude_cents bigint GENERATED ALWAYS AS (abs(amount_cents)) STORED;
ALTER TABLE finance.movements ADD CONSTRAINT movements_signed_amount_check CHECK (
  (event_type = 'RECEIVED_INCOME' AND amount_cents BETWEEN 1 AND 9007199254740991) OR
  (event_type = 'DIRECT_EXPENSE' AND amount_cents BETWEEN -9007199254740991 AND -1)
);
ALTER TABLE finance.movements ADD CONSTRAINT movements_version_fk
  FOREIGN KEY (household_id, event_id, version, id, account_id, magnitude_cents, effective_date, state, event_type)
  REFERENCES finance.event_versions(household_id, event_id, version, movement_id, account_id, amount_cents, effective_date, state, event_type)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE finance.expense_requests (
  household_id uuid NOT NULL REFERENCES household.households(id),
  request_key uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  request_payload jsonb NOT NULL,
  event_id uuid NOT NULL,
  response jsonb NOT NULL,
  PRIMARY KEY (household_id, request_key),
  FOREIGN KEY (household_id, actor_user_id) REFERENCES household.memberships(household_id, user_id),
  FOREIGN KEY (household_id, event_id) REFERENCES finance.events(household_id, id)
);
