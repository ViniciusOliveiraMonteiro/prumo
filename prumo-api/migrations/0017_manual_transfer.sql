ALTER TABLE finance.events DROP CONSTRAINT events_type_check;
ALTER TABLE finance.events ADD CONSTRAINT events_type_check
  CHECK (type IN ('RECEIVED_INCOME', 'DIRECT_EXPENSE', 'INTERNAL_TRANSFER'));

ALTER TABLE finance.event_versions DROP CONSTRAINT versions_category_type_check;
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_category_type_check CHECK (
  (event_type = 'RECEIVED_INCOME' AND category_id IS NULL) OR
  (event_type = 'DIRECT_EXPENSE' AND category_id IS NOT NULL) OR
  (event_type = 'INTERNAL_TRANSFER' AND category_id IS NULL)
);
ALTER TABLE finance.event_versions
  ADD COLUMN destination_movement_id uuid,
  ADD COLUMN destination_account_id uuid,
  ADD COLUMN destination_effective_date date;
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_transfer_shape_check CHECK (
  (event_type <> 'INTERNAL_TRANSFER' AND destination_movement_id IS NULL
    AND destination_account_id IS NULL AND destination_effective_date IS NULL) OR
  (event_type = 'INTERNAL_TRANSFER' AND state = 'APPLIED'
    AND destination_movement_id IS NOT NULL AND destination_account_id IS NOT NULL
    AND destination_effective_date IS NOT NULL
    AND destination_movement_id <> movement_id AND destination_account_id <> account_id
    AND effective_date <= destination_effective_date)
);
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_destination_account_fk
  FOREIGN KEY (household_id, destination_account_id)
  REFERENCES finance.accounts(household_id, id);
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_destination_movement_unique
  UNIQUE (household_id, event_id, version, destination_movement_id,
    destination_account_id, amount_cents, destination_effective_date, state, event_type);
ALTER TABLE finance.event_versions ADD CONSTRAINT version_requires_destination_movement
  FOREIGN KEY (household_id, destination_movement_id, version)
  REFERENCES finance.movements(household_id, id, version)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE finance.movements DROP CONSTRAINT movements_household_id_event_id_version_key;
ALTER TABLE finance.movements DROP CONSTRAINT movements_version_fk;
ALTER TABLE finance.movements DROP CONSTRAINT movements_signed_amount_check;
ALTER TABLE finance.movements ADD COLUMN side text NOT NULL DEFAULT 'SINGLE';
ALTER TABLE finance.movements ADD CONSTRAINT movements_side_check CHECK (
  (event_type = 'RECEIVED_INCOME' AND side = 'SINGLE'
    AND amount_cents BETWEEN 1 AND 9007199254740991) OR
  (event_type = 'DIRECT_EXPENSE' AND side = 'SINGLE'
    AND amount_cents BETWEEN -9007199254740991 AND -1) OR
  (event_type = 'INTERNAL_TRANSFER' AND side = 'TRANSFER_OUT'
    AND state = 'APPLIED' AND amount_cents BETWEEN -9007199254740991 AND -1) OR
  (event_type = 'INTERNAL_TRANSFER' AND side = 'TRANSFER_IN'
    AND state = 'APPLIED' AND amount_cents BETWEEN 1 AND 9007199254740991)
);
ALTER TABLE finance.movements ADD CONSTRAINT movements_one_per_side
  UNIQUE (household_id, event_id, version, side);
ALTER TABLE finance.movements
  ADD COLUMN source_ref_id uuid GENERATED ALWAYS AS (
    CASE WHEN side <> 'TRANSFER_IN' THEN id ELSE NULL END
  ) STORED,
  ADD COLUMN destination_ref_id uuid GENERATED ALWAYS AS (
    CASE WHEN side = 'TRANSFER_IN' THEN id ELSE NULL END
  ) STORED;
ALTER TABLE finance.movements ADD CONSTRAINT movements_source_version_fk
  FOREIGN KEY (household_id, event_id, version, source_ref_id,
    account_id, magnitude_cents, effective_date, state, event_type)
  REFERENCES finance.event_versions(household_id, event_id, version, movement_id,
    account_id, amount_cents, effective_date, state, event_type)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE finance.movements ADD CONSTRAINT movements_destination_version_fk
  FOREIGN KEY (household_id, event_id, version, destination_ref_id,
    account_id, magnitude_cents, effective_date, state, event_type)
  REFERENCES finance.event_versions(household_id, event_id, version,
    destination_movement_id, destination_account_id, amount_cents,
    destination_effective_date, state, event_type)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE finance.transfer_requests (
  household_id uuid NOT NULL REFERENCES household.households(id),
  operation text NOT NULL DEFAULT 'transfer:create' CHECK (operation = 'transfer:create'),
  request_key uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  request_payload jsonb NOT NULL,
  event_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'INTERNAL_TRANSFER' CHECK (event_type = 'INTERNAL_TRANSFER'),
  response jsonb NOT NULL,
  PRIMARY KEY (household_id, operation, request_key),
  FOREIGN KEY (household_id, actor_user_id)
    REFERENCES household.memberships(household_id, user_id),
  FOREIGN KEY (household_id, event_id, event_type)
    REFERENCES finance.events(household_id, id, type)
);
