ALTER TABLE finance.movements ADD CONSTRAINT movements_event_identity_unique
  UNIQUE (household_id, event_id, id, version);

ALTER TABLE finance.event_versions DROP CONSTRAINT version_requires_movement;
ALTER TABLE finance.event_versions ADD CONSTRAINT version_requires_movement
  FOREIGN KEY (household_id, event_id, movement_id, version)
  REFERENCES finance.movements(household_id, event_id, id, version)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE finance.event_versions DROP CONSTRAINT version_requires_destination_movement;
ALTER TABLE finance.event_versions ADD CONSTRAINT version_requires_destination_movement
  FOREIGN KEY (household_id, event_id, destination_movement_id, version)
  REFERENCES finance.movements(household_id, event_id, id, version)
  DEFERRABLE INITIALLY DEFERRED;
