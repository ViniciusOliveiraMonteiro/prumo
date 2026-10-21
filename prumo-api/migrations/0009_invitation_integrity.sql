ALTER TABLE household.invitations
  ADD CONSTRAINT invitations_event_scope_key
    UNIQUE (household_id, id, invitee_user_id);

ALTER TABLE household.events
  DROP CONSTRAINT events_payload_check,
  ADD CONSTRAINT events_payload_check CHECK (
    (kind = 'membership_revoked' AND target_user_id IS NOT NULL
      AND previous_role IS NOT NULL AND previous_role IN ('MEMBER', 'VIEWER')
      AND invitation_id IS NULL AND invitee_user_id IS NULL)
    OR (kind IN ('invitation_created', 'invitation_cancelled', 'invitation_accepted')
      AND invitation_id IS NOT NULL AND invitee_user_id IS NOT NULL
      AND target_user_id IS NULL AND previous_role IS NULL)
    OR (kind IN ('created', 'renamed') AND target_user_id IS NULL
      AND previous_role IS NULL AND invitation_id IS NULL AND invitee_user_id IS NULL)
  ),
  ADD CONSTRAINT events_invitation_scope_fkey
    FOREIGN KEY (household_id, invitation_id, invitee_user_id)
    REFERENCES household.invitations(household_id, id, invitee_user_id);
