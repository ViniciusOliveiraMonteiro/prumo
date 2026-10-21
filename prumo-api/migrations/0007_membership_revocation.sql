ALTER TABLE household.events
  DROP CONSTRAINT events_kind_check,
  ADD COLUMN target_user_id uuid,
  ADD COLUMN previous_role text,
  ADD CONSTRAINT events_kind_check
    CHECK (kind IN ('created', 'renamed', 'membership_revoked')),
  ADD CONSTRAINT events_revocation_payload_check CHECK (
    (kind = 'membership_revoked' AND target_user_id IS NOT NULL
      AND previous_role IS NOT NULL AND previous_role IN ('MEMBER', 'VIEWER'))
    OR (kind <> 'membership_revoked' AND target_user_id IS NULL AND previous_role IS NULL)
  ),
  ADD CONSTRAINT events_target_membership_fkey
    FOREIGN KEY (household_id, target_user_id)
    REFERENCES household.memberships(household_id, user_id);
