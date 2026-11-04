ALTER TABLE finance.income_requests
  ADD COLUMN event_type text NOT NULL DEFAULT 'RECEIVED_INCOME'
  CONSTRAINT income_request_event_type_check CHECK (event_type = 'RECEIVED_INCOME');
ALTER TABLE finance.income_requests
  ADD CONSTRAINT income_request_event_type_fk
  FOREIGN KEY (household_id, event_id, event_type)
  REFERENCES finance.events(household_id, id, type);

ALTER TABLE finance.expense_requests
  ADD COLUMN event_type text NOT NULL DEFAULT 'DIRECT_EXPENSE'
  CONSTRAINT expense_request_event_type_check CHECK (event_type = 'DIRECT_EXPENSE');
ALTER TABLE finance.expense_requests
  ADD CONSTRAINT expense_request_event_type_fk
  FOREIGN KEY (household_id, event_id, event_type)
  REFERENCES finance.events(household_id, id, type);
