CREATE OR REPLACE FUNCTION finance.guard_movement_fact_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- Stored generated columns are recomputed after BEFORE triggers; compare their inputs.
 IF (NEW.id,NEW.household_id,NEW.event_id,NEW.version,NEW.account_id,
     NEW.amount_cents,NEW.effective_date,NEW.event_type,NEW.side,NEW.sequence)
   IS DISTINCT FROM
    (OLD.id,OLD.household_id,OLD.event_id,OLD.version,OLD.account_id,
     OLD.amount_cents,OLD.effective_date,OLD.event_type,OLD.side,OLD.sequence)
 THEN RAISE EXCEPTION 'Accepted movement facts are immutable'; END IF;
 IF NEW.state IS DISTINCT FROM OLD.state AND NOT EXISTS (
   SELECT 1 FROM finance.events e WHERE e.household_id = OLD.household_id
     AND e.id = OLD.event_id AND e.current_version = OLD.version
 ) THEN RAISE EXCEPTION 'Historical movement state is immutable'; END IF;
 RETURN NEW;
END; $$;
