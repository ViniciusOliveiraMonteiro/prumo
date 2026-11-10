CREATE OR REPLACE FUNCTION finance.guard_arrival_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.version = 1 THEN RETURN NULL; END IF;
 IF NOT EXISTS (
 SELECT 1 FROM finance.event_versions prior
 JOIN finance.arrival_links l ON (l.household_id,l.event_id,l.previous_version) = (prior.household_id,prior.event_id,prior.version)
 JOIN finance.events e ON (e.household_id,e.id,e.current_version,e.type) = (NEW.household_id,NEW.event_id,NEW.version,NEW.event_type)
 JOIN finance.movements src ON (src.household_id,src.id,src.version) = (prior.household_id,prior.movement_id,prior.version)
 JOIN finance.movements next_src ON (next_src.household_id,next_src.id,next_src.version) = (NEW.household_id,NEW.movement_id,NEW.version)
 WHERE prior.household_id = NEW.household_id AND prior.event_id = NEW.event_id AND prior.version = 1
 AND prior.event_type = 'UNCLASSIFIED_OUTFLOW' AND NEW.event_type = 'INTERNAL_TRANSFER'
 AND (NEW.movement_id,NEW.account_id,NEW.amount_cents,NEW.currency,NEW.effective_date,NEW.description,NEW.date_provenance,NEW.recorded_by_user_id,NEW.recorded_at)
 = (prior.movement_id,prior.account_id,prior.amount_cents,prior.currency,prior.effective_date,prior.description,prior.date_provenance,prior.recorded_by_user_id,prior.recorded_at)
 AND src.sequence = next_src.sequence
 ) THEN RAISE EXCEPTION 'Arrival version requires immutable source and matching audit'; END IF;
 RETURN NULL;
END; $$;
