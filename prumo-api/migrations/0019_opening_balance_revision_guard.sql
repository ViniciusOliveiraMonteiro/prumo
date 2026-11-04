CREATE FUNCTION finance.guard_opening_balance_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.opening_date <> OLD.opening_date THEN
    RAISE EXCEPTION 'Opening date revision is not supported';
  END IF;
  IF NEW.opening_version <> OLD.opening_version + 1 OR NOT EXISTS (
    SELECT 1 FROM finance.opening_balance_revisions r
    WHERE r.household_id = OLD.household_id AND r.account_id = OLD.id
      AND r.previous_version = OLD.opening_version
      AND r.version = NEW.opening_version
      AND r.opening_date = OLD.opening_date
      AND r.previous_balance_cents = OLD.opening_balance_cents
      AND r.opening_balance_cents = NEW.opening_balance_cents
  ) THEN
    RAISE EXCEPTION 'Opening balance update requires a matching audit revision';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_opening_balance_revision
BEFORE UPDATE OF opening_balance_cents, opening_version, opening_date
ON finance.accounts FOR EACH ROW
EXECUTE FUNCTION finance.guard_opening_balance_revision();
