ALTER TABLE finance.movements ADD CONSTRAINT movement_transition_fact_unique
  UNIQUE (household_id, id, version, account_id, event_id);
ALTER TABLE finance.movement_opening_transitions
  ADD CONSTRAINT transition_movement_fact_fk
  FOREIGN KEY (household_id, movement_id, movement_version, account_id, event_id)
  REFERENCES finance.movements(household_id, id, version, account_id, event_id);

CREATE FUNCTION finance.check_inserted_opening_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM finance.opening_balance_revisions r
    JOIN finance.accounts a ON (a.household_id, a.id) = (r.household_id, r.account_id)
    JOIN finance.movements m ON (m.household_id, m.id, m.version)
      = (NEW.household_id, NEW.movement_id, NEW.movement_version)
    WHERE r.id = NEW.revision_id AND r.household_id = NEW.household_id
      AND r.account_id = NEW.account_id AND r.version <= a.opening_version
      AND m.account_id = NEW.account_id AND m.event_id = NEW.event_id
      AND (
        EXISTS (
          SELECT 1 FROM finance.movement_opening_transitions later
          JOIN finance.opening_balance_revisions next_revision
            ON next_revision.id = later.revision_id
          WHERE later.household_id = NEW.household_id
            AND later.movement_id = NEW.movement_id
            AND later.movement_version = NEW.movement_version
            AND next_revision.version > r.version
        ) OR m.state = NEW.state
      )
  ) THEN
    RAISE EXCEPTION 'Opening transition must match the final movement state';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER check_inserted_opening_transition
AFTER INSERT ON finance.movement_opening_transitions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION finance.check_inserted_opening_transition();
