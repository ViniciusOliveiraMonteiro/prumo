-- Historical classifications belong to versions; only the current version constrains events.type.
ALTER TABLE finance.events DROP CONSTRAINT events_current_version_check;
ALTER TABLE finance.events ADD CHECK (current_version IN (1, 2));
ALTER TABLE finance.event_versions DROP CONSTRAINT event_versions_version_check;
ALTER TABLE finance.event_versions ADD CHECK (version IN (1, 2));
ALTER TABLE finance.movements DROP CONSTRAINT movements_version_check;
ALTER TABLE finance.movements ADD CHECK (version IN (1, 2));
ALTER TABLE finance.events DROP CONSTRAINT events_type_check;
ALTER TABLE finance.events ADD CHECK (type IN ('RECEIVED_INCOME','DIRECT_EXPENSE','INTERNAL_TRANSFER','UNCLASSIFIED_OUTFLOW'));
ALTER TABLE finance.event_versions DROP CONSTRAINT versions_event_type_fk;
ALTER TABLE finance.event_versions ADD UNIQUE (household_id,event_id,version,event_type);
ALTER TABLE finance.events ADD CONSTRAINT current_version_type_fk
 FOREIGN KEY (household_id,id,current_version,type)
 REFERENCES finance.event_versions(household_id,event_id,version,event_type) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE finance.event_versions DROP CONSTRAINT versions_category_type_check;
ALTER TABLE finance.event_versions ADD CONSTRAINT versions_category_type_check CHECK (
 (event_type IN ('RECEIVED_INCOME','INTERNAL_TRANSFER','UNCLASSIFIED_OUTFLOW') AND category_id IS NULL)
 OR (event_type = 'DIRECT_EXPENSE' AND category_id IS NOT NULL));
ALTER TABLE finance.movements DROP CONSTRAINT movements_side_check;
ALTER TABLE finance.movements ADD CONSTRAINT movements_side_check CHECK (
 (event_type = 'RECEIVED_INCOME' AND side = 'SINGLE' AND amount_cents > 0) OR
 (event_type IN ('DIRECT_EXPENSE','UNCLASSIFIED_OUTFLOW') AND side = 'SINGLE' AND amount_cents < 0) OR
 (event_type = 'INTERNAL_TRANSFER' AND side = 'TRANSFER_OUT' AND amount_cents < 0) OR
 (event_type = 'INTERNAL_TRANSFER' AND side = 'TRANSFER_IN' AND amount_cents > 0));
ALTER TABLE finance.movements ADD CHECK (amount_cents BETWEEN -9007199254740991 AND 9007199254740991);

CREATE TABLE finance.arrival_links (
 household_id uuid NOT NULL, event_id uuid NOT NULL, version integer NOT NULL CHECK (version = 2),
 previous_version integer NOT NULL DEFAULT 1 CHECK (previous_version = 1),
 actor_user_id uuid NOT NULL, reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 240 AND reason = btrim(reason)),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (household_id,event_id,version),
 FOREIGN KEY (household_id,event_id,version) REFERENCES finance.event_versions(household_id,event_id,version) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY (household_id,event_id,previous_version) REFERENCES finance.event_versions(household_id,event_id,version),
 FOREIGN KEY (household_id,actor_user_id) REFERENCES household.memberships(household_id,user_id)
);
CREATE TABLE finance.outflow_requests (
 household_id uuid NOT NULL, operation text NOT NULL CHECK (operation IN ('outflow:create','outflow:link')),
 request_key uuid NOT NULL, actor_user_id uuid NOT NULL, request_payload jsonb NOT NULL,
 event_id uuid NOT NULL, version integer NOT NULL, event_type text NOT NULL, response jsonb NOT NULL,
 PRIMARY KEY(household_id,operation,request_key),
 FOREIGN KEY (household_id,actor_user_id) REFERENCES household.memberships(household_id,user_id),
 FOREIGN KEY (household_id,event_id,version,event_type) REFERENCES finance.event_versions(household_id,event_id,version,event_type)
);
CREATE FUNCTION finance.guard_arrival_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.version = 1 THEN RETURN NULL; END IF;
 IF NOT EXISTS (
 SELECT 1 FROM finance.event_versions old
 JOIN finance.arrival_links l ON (l.household_id,l.event_id,l.previous_version) = (old.household_id,old.event_id,old.version)
 JOIN finance.events e ON (e.household_id,e.id,e.current_version,e.type) = (NEW.household_id,NEW.event_id,NEW.version,NEW.event_type)
 JOIN finance.movements src ON (src.household_id,src.id,src.version) = (old.household_id,old.movement_id,old.version)
 JOIN finance.movements next_src ON (next_src.household_id,next_src.id,next_src.version) = (NEW.household_id,NEW.movement_id,NEW.version)
 WHERE old.household_id = NEW.household_id AND old.event_id = NEW.event_id AND old.version = 1
 AND old.event_type = 'UNCLASSIFIED_OUTFLOW' AND NEW.event_type = 'INTERNAL_TRANSFER'
 AND (NEW.movement_id,NEW.account_id,NEW.amount_cents,NEW.currency,NEW.effective_date,NEW.description,NEW.date_provenance,NEW.recorded_by_user_id,NEW.recorded_at)
 = (old.movement_id,old.account_id,old.amount_cents,old.currency,old.effective_date,old.description,old.date_provenance,old.recorded_by_user_id,old.recorded_at)
 AND src.sequence = next_src.sequence
 ) THEN RAISE EXCEPTION 'Arrival version requires immutable source and matching audit'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER guard_arrival_version AFTER INSERT ON finance.event_versions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance.guard_arrival_version();
CREATE FUNCTION finance.guard_event_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id <> OLD.id OR NEW.household_id <> OLD.household_id OR
 OLD.type <> 'UNCLASSIFIED_OUTFLOW' OR NEW.type <> 'INTERNAL_TRANSFER' OR
 OLD.current_version <> 1 OR NEW.current_version <> 2 OR NOT EXISTS (
 SELECT 1 FROM finance.arrival_links WHERE household_id = NEW.household_id AND event_id = NEW.id AND version = 2
 ) THEN RAISE EXCEPTION 'Event update requires arrival audit'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_event_transition BEFORE UPDATE ON finance.events FOR EACH ROW EXECUTE FUNCTION finance.guard_event_transition();
CREATE FUNCTION finance.reject_financial_fact_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Accepted financial facts are immutable'; END; $$;
CREATE TRIGGER immutable_event_version BEFORE UPDATE ON finance.event_versions FOR EACH ROW EXECUTE FUNCTION finance.reject_financial_fact_update();
CREATE TRIGGER immutable_arrival_link BEFORE UPDATE ON finance.arrival_links FOR EACH ROW EXECUTE FUNCTION finance.reject_financial_fact_update();
CREATE FUNCTION finance.guard_movement_fact_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.household_id,NEW.event_id,NEW.version,NEW.account_id,
     NEW.amount_cents,NEW.magnitude_cents,NEW.effective_date,NEW.event_type,
     NEW.side,NEW.sequence)
   IS DISTINCT FROM
    (OLD.id,OLD.household_id,OLD.event_id,OLD.version,OLD.account_id,
     OLD.amount_cents,OLD.magnitude_cents,OLD.effective_date,OLD.event_type,
     OLD.side,OLD.sequence)
 THEN RAISE EXCEPTION 'Accepted movement facts are immutable'; END IF;
 IF NEW.state IS DISTINCT FROM OLD.state AND NOT EXISTS (
   SELECT 1 FROM finance.events e WHERE e.household_id = OLD.household_id
     AND e.id = OLD.event_id AND e.current_version = OLD.version
 ) THEN RAISE EXCEPTION 'Historical movement state is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_movement_fact_update BEFORE UPDATE ON finance.movements
 FOR EACH ROW EXECUTE FUNCTION finance.guard_movement_fact_update();
CREATE OR REPLACE FUNCTION finance.check_movement_opening_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_account_id uuid;
BEGIN
 IF TG_TABLE_NAME = 'accounts' THEN target_account_id := NEW.id;
 ELSE target_account_id := NEW.account_id; END IF;
 IF EXISTS (
 SELECT 1 FROM finance.movements m
 JOIN finance.events e ON (e.household_id,e.id,e.current_version) = (m.household_id,m.event_id,m.version)
 JOIN finance.accounts a ON (a.household_id,a.id) = (m.household_id,m.account_id)
 WHERE m.household_id = NEW.household_id AND m.account_id = target_account_id
 AND m.state <> CASE WHEN m.effective_date < a.opening_date THEN 'PENDING_PRE_OPENING' ELSE 'APPLIED' END
 ) THEN RAISE EXCEPTION 'Movement state disagrees with account opening date'; END IF;
 RETURN NULL;
END; $$;
