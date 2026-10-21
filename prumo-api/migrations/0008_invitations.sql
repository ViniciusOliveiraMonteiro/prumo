CREATE TABLE household.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES household.households(id),
  inviter_user_id uuid NOT NULL REFERENCES identity.users(id),
  invitee_user_id uuid NOT NULL REFERENCES identity.users(id),
  role text NOT NULL DEFAULT 'VIEWER' CHECK (role = 'VIEWER'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'cancelled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK ((state = 'accepted') = (accepted_at IS NOT NULL)),
  CHECK ((state = 'cancelled') = (cancelled_at IS NOT NULL)),
  CHECK (accepted_at IS NULL OR cancelled_at IS NULL)
);
CREATE UNIQUE INDEX invitations_pending_pair_idx
  ON household.invitations(household_id, invitee_user_id) WHERE state = 'pending';
CREATE INDEX invitations_inbox_idx
  ON household.invitations(invitee_user_id, expires_at) WHERE state = 'pending';
CREATE INDEX invitations_actor_window_idx
  ON household.invitations(household_id, inviter_user_id, created_at);

-- Count every authorized request, including requests for unknown users, identically.
CREATE TABLE household.invitation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES household.households(id),
  actor_user_id uuid NOT NULL REFERENCES identity.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitation_requests_limit_idx
  ON household.invitation_requests(household_id, actor_user_id, created_at);

ALTER TABLE household.events
  DROP CONSTRAINT events_kind_check,
  DROP CONSTRAINT events_revocation_payload_check,
  ADD COLUMN invitation_id uuid REFERENCES household.invitations(id),
  ADD COLUMN invitee_user_id uuid REFERENCES identity.users(id),
  ADD CONSTRAINT events_kind_check CHECK (kind IN (
    'created', 'renamed', 'membership_revoked',
    'invitation_created', 'invitation_cancelled', 'invitation_accepted'
  )),
  ADD CONSTRAINT events_payload_check CHECK (
    (kind = 'membership_revoked' AND target_user_id IS NOT NULL
      AND previous_role IN ('MEMBER', 'VIEWER')
      AND invitation_id IS NULL AND invitee_user_id IS NULL)
    OR (kind IN ('invitation_created', 'invitation_cancelled', 'invitation_accepted')
      AND invitation_id IS NOT NULL AND invitee_user_id IS NOT NULL
      AND target_user_id IS NULL AND previous_role IS NULL)
    OR (kind IN ('created', 'renamed') AND target_user_id IS NULL
      AND previous_role IS NULL AND invitation_id IS NULL AND invitee_user_id IS NULL)
  );
