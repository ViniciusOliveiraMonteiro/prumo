CREATE FUNCTION finance.guard_initial_event_type() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.version = 1 AND NOT EXISTS (
   SELECT 1 FROM finance.events e WHERE e.household_id = NEW.household_id
     AND e.id = NEW.event_id AND e.type = NEW.event_type
 ) THEN RAISE EXCEPTION 'Initial event version must match event type'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_initial_event_type BEFORE INSERT ON finance.event_versions
 FOR EACH ROW EXECUTE FUNCTION finance.guard_initial_event_type();
