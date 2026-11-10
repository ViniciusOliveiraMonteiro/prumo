CREATE OR REPLACE FUNCTION finance.check_movement_opening_state() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_account_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'accounts' THEN
    target_account_id := NEW.id;
  ELSE
    target_account_id := NEW.account_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM finance.movements m
    JOIN finance.accounts a ON (a.household_id, a.id) = (m.household_id, m.account_id)
    WHERE m.household_id = NEW.household_id AND m.account_id = target_account_id
      AND m.state <> CASE WHEN m.effective_date < a.opening_date
        THEN 'PENDING_PRE_OPENING' ELSE 'APPLIED' END
  ) THEN
    RAISE EXCEPTION 'Movement state disagrees with account opening date';
  END IF;
  RETURN NULL;
END;
$$;

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
    RAISE EXCEPTION 'Opening balance update requires a matching audit revision';
  END IF;
  RETURN NEW;
END;
$$;
