ALTER TABLE finance.opening_balance_revisions
  ADD COLUMN previous_opening_date date;
UPDATE finance.opening_balance_revisions
SET previous_opening_date = opening_date;
ALTER TABLE finance.opening_balance_revisions
  ALTER COLUMN previous_opening_date SET NOT NULL;

CREATE OR REPLACE FUNCTION finance.guard_opening_balance_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.opening_version <> OLD.opening_version + 1 OR NOT EXISTS (
    SELECT 1 FROM finance.opening_balance_revisions r
    WHERE r.household_id = OLD.household_id AND r.account_id = OLD.id
      AND r.previous_version = OLD.opening_version
      AND r.version = NEW.opening_version
      AND r.previous_opening_date = OLD.opening_date
      AND r.opening_date = NEW.opening_date
      AND r.previous_balance_cents = OLD.opening_balance_cents
      AND r.opening_balance_cents = NEW.opening_balance_cents
  ) THEN
    RAISE EXCEPTION 'Opening update requires a matching audit revision';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE finance.movements DROP CONSTRAINT movements_source_version_fk;
ALTER TABLE finance.movements DROP CONSTRAINT movements_destination_version_fk;
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_source_fact_unique
  UNIQUE (household_id, event_id, version, movement_id, account_id,
    amount_cents, effective_date, event_type);
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_destination_fact_unique
  UNIQUE (household_id, event_id, version, destination_movement_id,
    destination_account_id, amount_cents, destination_effective_date, event_type);
ALTER TABLE finance.movements ADD CONSTRAINT movements_source_fact_fk
  FOREIGN KEY (household_id, event_id, version, source_ref_id,
    account_id, magnitude_cents, effective_date, event_type)
  REFERENCES finance.event_versions(household_id, event_id, version, movement_id,
    account_id, amount_cents, effective_date, event_type)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE finance.movements ADD CONSTRAINT movements_destination_fact_fk
  FOREIGN KEY (household_id, event_id, version, destination_ref_id,
    account_id, magnitude_cents, effective_date, event_type)
  REFERENCES finance.event_versions(household_id, event_id, version,
    destination_movement_id, destination_account_id, amount_cents,
    destination_effective_date, event_type)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE finance.movements DROP CONSTRAINT movements_side_check;
ALTER TABLE finance.movements ADD CONSTRAINT movements_side_check CHECK (
  (event_type = 'RECEIVED_INCOME' AND side = 'SINGLE'
    AND amount_cents BETWEEN 1 AND 9007199254740991) OR
  (event_type = 'DIRECT_EXPENSE' AND side = 'SINGLE'
    AND amount_cents BETWEEN -9007199254740991 AND -1) OR
  (event_type = 'INTERNAL_TRANSFER' AND side = 'TRANSFER_OUT'
    AND amount_cents BETWEEN -9007199254740991 AND -1) OR
  (event_type = 'INTERNAL_TRANSFER' AND side = 'TRANSFER_IN'
    AND amount_cents BETWEEN 1 AND 9007199254740991)
);

CREATE TABLE finance.movement_opening_transitions (
  household_id uuid NOT NULL,
  account_id uuid NOT NULL,
  movement_id uuid NOT NULL,
  movement_version integer NOT NULL,
  event_id uuid NOT NULL,
  revision_id uuid NOT NULL,
  previous_state text NOT NULL,
  state text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (household_id, movement_id, movement_version, revision_id),
  CHECK (previous_state IN ('APPLIED', 'PENDING_PRE_OPENING')),
  CHECK (state IN ('APPLIED', 'PENDING_PRE_OPENING') AND state <> previous_state),
  FOREIGN KEY (household_id, account_id, revision_id)
    REFERENCES finance.opening_balance_revisions(household_id, account_id, id),
  FOREIGN KEY (household_id, movement_id, movement_version)
    REFERENCES finance.movements(household_id, id, version),
  FOREIGN KEY (household_id, event_id)
    REFERENCES finance.events(household_id, id)
);

CREATE FUNCTION finance.guard_movement_opening_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = OLD.state THEN RETURN NEW; END IF;
  IF NEW.id <> OLD.id OR NEW.household_id <> OLD.household_id
    OR NEW.account_id <> OLD.account_id OR NEW.event_id <> OLD.event_id
    OR NEW.version <> OLD.version OR NEW.amount_cents <> OLD.amount_cents
    OR NEW.effective_date <> OLD.effective_date THEN
    RAISE EXCEPTION 'Movement facts cannot be changed by an opening revision';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM finance.accounts a
    JOIN finance.opening_balance_revisions r
      ON (r.household_id, r.account_id, r.version)
       = (a.household_id, a.id, a.opening_version)
    JOIN finance.movement_opening_transitions t
      ON (t.household_id, t.account_id, t.revision_id)
       = (r.household_id, r.account_id, r.id)
    WHERE a.household_id = NEW.household_id AND a.id = NEW.account_id
      AND t.movement_id = NEW.id AND t.movement_version = NEW.version
      AND t.event_id = NEW.event_id
      AND t.previous_state = OLD.state AND t.state = NEW.state
      AND NEW.state = CASE WHEN NEW.effective_date < a.opening_date
        THEN 'PENDING_PRE_OPENING' ELSE 'APPLIED' END
  ) THEN
    RAISE EXCEPTION 'Movement state update requires a matching opening revision';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_movement_opening_transition
BEFORE UPDATE ON finance.movements FOR EACH ROW
EXECUTE FUNCTION finance.guard_movement_opening_transition();

CREATE FUNCTION finance.check_movement_opening_state() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM finance.movements m
    JOIN finance.accounts a ON (a.household_id, a.id) = (m.household_id, m.account_id)
    WHERE m.household_id = NEW.household_id AND m.account_id = NEW.account_id
      AND m.state <> CASE WHEN m.effective_date < a.opening_date
        THEN 'PENDING_PRE_OPENING' ELSE 'APPLIED' END
  ) THEN
    RAISE EXCEPTION 'Movement state disagrees with account opening date';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER check_account_movement_opening_state
AFTER UPDATE OF opening_date ON finance.accounts
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION finance.check_movement_opening_state();
CREATE CONSTRAINT TRIGGER check_movement_opening_state
AFTER INSERT OR UPDATE OF state ON finance.movements
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION finance.check_movement_opening_state();
