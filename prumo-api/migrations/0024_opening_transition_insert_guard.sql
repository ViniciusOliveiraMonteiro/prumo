CREATE FUNCTION finance.guard_inserted_opening_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM finance.opening_balance_revisions r
    JOIN finance.accounts a ON (a.household_id, a.id, a.opening_version)
      = (r.household_id, r.account_id, r.version)
    JOIN finance.movements m ON (m.household_id, m.id, m.version)
      = (NEW.household_id, NEW.movement_id, NEW.movement_version)
    WHERE r.id = NEW.revision_id AND r.household_id = NEW.household_id
      AND r.account_id = NEW.account_id
      AND m.account_id = NEW.account_id AND m.event_id = NEW.event_id
      AND m.state = NEW.previous_state
      AND NEW.state = CASE WHEN m.effective_date < r.opening_date
        THEN 'PENDING_PRE_OPENING' ELSE 'APPLIED' END
      AND NEW.previous_state = CASE WHEN m.effective_date < r.previous_opening_date
        THEN 'PENDING_PRE_OPENING' ELSE 'APPLIED' END
  ) THEN
    RAISE EXCEPTION 'Opening transition must belong to the current revision and prior movement state';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_inserted_opening_transition
BEFORE INSERT ON finance.movement_opening_transitions FOR EACH ROW
EXECUTE FUNCTION finance.guard_inserted_opening_transition();
