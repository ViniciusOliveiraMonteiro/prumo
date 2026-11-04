ALTER TABLE finance.opening_balance_revisions
  ADD CONSTRAINT opening_revision_household_account_id_unique
  UNIQUE (household_id, account_id, id);

ALTER TABLE finance.opening_balance_revision_requests
  DROP CONSTRAINT opening_balance_revision_requests_revision_id_fkey;
ALTER TABLE finance.opening_balance_revision_requests
  ADD CONSTRAINT opening_revision_request_revision_fk
  FOREIGN KEY (household_id, account_id, revision_id)
  REFERENCES finance.opening_balance_revisions(household_id, account_id, id);

ALTER TABLE finance.account_requests ADD COLUMN response jsonb;
UPDATE finance.account_requests req SET response = jsonb_build_object(
  'id', a.id, 'name', a.name, 'currency', a.currency,
  'openingDate', a.opening_date::text,
  'openingBalanceCents', COALESCE(first.previous_balance_cents, a.opening_balance_cents)::text,
  'openingVersion', 1
)
FROM finance.accounts a
LEFT JOIN finance.opening_balance_revisions first
  ON first.household_id = a.household_id AND first.account_id = a.id AND first.version = 2
WHERE req.household_id = a.household_id AND req.account_id = a.id;
ALTER TABLE finance.account_requests ALTER COLUMN response SET NOT NULL;
