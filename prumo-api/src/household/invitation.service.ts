import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IdentityDatabase } from '../identity/identity.database.js';

export type InvitationView = {
  id: string;
  householdId: string;
  householdName: string;
  role: 'VIEWER';
  expiresAt: string;
};

type Invitation = {
  id: string;
  householdId: string;
  inviterUserId: string;
  inviteeUserId: string;
  state: 'pending' | 'accepted' | 'cancelled' | 'expired';
  valid: boolean;
};

@Injectable()
export class InvitationService {
  constructor(private readonly database: IdentityDatabase) {}

  async create(
    actorId: string,
    householdId: string,
    inviteeId: string,
  ): Promise<{ requestId: string }> {
    return this.database.db.transaction(async (tx) => {
      // The owner row serializes this actor's requests and precedes invitation locks.
      const owner = await tx.execute<{ role: string }>(sql`
        SELECT role FROM household.memberships
        WHERE household_id = ${householdId} AND user_id = ${actorId} AND active
        FOR UPDATE
      `);
      if (!owner.rows[0]) throw new NotFoundException('Household not found');
      if (owner.rows[0].role !== 'OWNER')
        throw new ForbiddenException('Household action denied');
      // Serialize the household-wide pending cap across different owners.
      await tx.execute(sql`
        SELECT id FROM household.households WHERE id = ${householdId} FOR UPDATE
      `);
      await tx.execute(sql`
        DELETE FROM household.invitation_requests
        WHERE created_at < clock_timestamp() - interval '30 days'
      `);
      const count = await tx.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM household.invitation_requests
        WHERE household_id = ${householdId} AND actor_user_id = ${actorId}
          AND created_at > clock_timestamp() - interval '1 day'
      `);
      if (Number(count.rows[0].count) >= 20)
        throw new HttpException(
          'Too many invitation requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      await tx.execute(sql`
        INSERT INTO household.invitation_requests(household_id, actor_user_id)
        VALUES (${householdId}, ${actorId})
      `);
      await tx.execute(sql`
        UPDATE household.invitations SET state = 'expired'
        WHERE household_id = ${householdId} AND invitee_user_id = ${inviteeId}
          AND state = 'pending' AND expires_at <= clock_timestamp()
      `);
      const pending = await tx.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM household.invitations
        WHERE household_id = ${householdId} AND state = 'pending'
          AND expires_at > clock_timestamp()
      `);
      // Run the same bounded reads for unknown and known recipients before
      // deciding whether to create a deliverable invitation.
      const eligible = await tx.execute<{ id: string }>(sql`
        SELECT u.id FROM identity.users u
        WHERE u.id = ${inviteeId} AND u.active AND u.id <> ${actorId}
          AND NOT EXISTS (
            SELECT 1 FROM household.memberships m
            WHERE m.household_id = ${householdId} AND m.user_id = u.id
          )
        FOR SHARE OF u
      `);
      const deliverable =
        Boolean(eligible.rows[0]) && Number(pending.rows[0].count) < 100;
      const inserted = await tx.execute<{ id: string }>(sql`
        INSERT INTO household.invitations(household_id, inviter_user_id, invitee_user_id)
        SELECT ${householdId}, ${actorId}, ${inviteeId} WHERE ${deliverable}
        ON CONFLICT (household_id, invitee_user_id) WHERE state = 'pending'
        DO NOTHING RETURNING id
      `);
      const id = inserted.rows[0]?.id ?? randomUUID();
      // Execute the audit statement for every authorized request. A request
      // without a delivered invitation selects no row and writes no event.
      await tx.execute(sql`
        INSERT INTO household.events(
          household_id, actor_user_id, kind, invitation_id, invitee_user_id
        ) SELECT ${householdId}, ${actorId}, 'invitation_created', id, ${inviteeId}
          FROM household.invitations WHERE id = ${id}
      `);
      return { requestId: id };
    });
  }

  async inbox(userId: string): Promise<InvitationView[]> {
    const result = await this.database.db.execute<InvitationView>(sql`
      SELECT i.id, i.household_id AS "householdId", h.name AS "householdName",
        i.role, i.expires_at AS "expiresAt"
      FROM household.invitations i
      JOIN household.households h ON h.id = i.household_id
      JOIN identity.users u ON u.id = i.invitee_user_id AND u.active
      JOIN household.memberships owner ON owner.household_id = i.household_id
        AND owner.user_id = i.inviter_user_id AND owner.active AND owner.role = 'OWNER'
      WHERE i.invitee_user_id = ${userId} AND i.state = 'pending'
        AND i.expires_at > clock_timestamp()
        AND NOT EXISTS (
          SELECT 1 FROM household.memberships m
          WHERE m.household_id = i.household_id AND m.user_id = ${userId}
        )
      ORDER BY i.created_at, i.id
    `);
    return result.rows.map((invitation) => ({
      ...invitation,
      expiresAt: new Date(invitation.expiresAt).toISOString(),
    }));
  }

  async cancel(
    actorId: string,
    householdId: string,
    invitationId: string,
  ): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const owner = await tx.execute<{ role: string }>(sql`
        SELECT role FROM household.memberships
        WHERE household_id = ${householdId} AND user_id = ${actorId} AND active
        FOR SHARE
      `);
      if (!owner.rows[0]) throw new NotFoundException('Household not found');
      if (owner.rows[0].role !== 'OWNER')
        throw new ForbiddenException('Household action denied');
      const changed = await tx.execute<{ inviteeUserId: string }>(sql`
        UPDATE household.invitations SET state = 'cancelled', cancelled_at = clock_timestamp()
        WHERE id = ${invitationId} AND household_id = ${householdId}
          AND state = 'pending' AND expires_at > clock_timestamp()
        RETURNING invitee_user_id AS "inviteeUserId"
      `);
      if (changed.rows[0])
        await tx.execute(sql`
        INSERT INTO household.events(
          household_id, actor_user_id, kind, invitation_id, invitee_user_id
        ) VALUES (
          ${householdId}, ${actorId}, 'invitation_cancelled',
          ${invitationId}, ${changed.rows[0].inviteeUserId}
        )
      `);
    });
  }

  async accept(userId: string, invitationId: string): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const lookup = await tx.execute<Invitation>(sql`
        SELECT id, household_id AS "householdId", inviter_user_id AS "inviterUserId",
          invitee_user_id AS "inviteeUserId", state,
          expires_at > clock_timestamp() AS valid
        FROM household.invitations WHERE id = ${invitationId} AND invitee_user_id = ${userId}
      `);
      const invitation = lookup.rows[0];
      if (!invitation) throw new NotFoundException('Invitation not found');
      // Lock owner before invitation, matching creation/cancellation and membership operations.
      const owner = await tx.execute<{ role: string }>(sql`
        SELECT role FROM household.memberships
        WHERE household_id = ${invitation.householdId}
          AND user_id = ${invitation.inviterUserId} AND active FOR SHARE
      `);
      const locked = await tx.execute<Invitation>(sql`
        SELECT id, household_id AS "householdId", inviter_user_id AS "inviterUserId",
          invitee_user_id AS "inviteeUserId", state,
          expires_at > clock_timestamp() AS valid
        FROM household.invitations WHERE id = ${invitationId} AND invitee_user_id = ${userId}
        FOR UPDATE
      `);
      const current = locked.rows[0];
      if (!current) throw new NotFoundException('Invitation not found');
      if (current.state === 'accepted') {
        const membership = await tx.execute<{ active: boolean }>(sql`
          SELECT active FROM household.memberships
          WHERE household_id = ${current.householdId} AND user_id = ${userId}
        `);
        if (membership.rows[0]?.active) return;
        throw new ConflictException('Membership revoked');
      }
      if (
        current.state !== 'pending' ||
        !current.valid ||
        owner.rows[0]?.role !== 'OWNER'
      )
        throw new NotFoundException('Invitation not found');
      const activeUser = await tx.execute<{ id: string }>(sql`
        SELECT id FROM identity.users WHERE id = ${userId} AND active FOR SHARE
      `);
      if (!activeUser.rows[0])
        throw new NotFoundException('Invitation not found');
      const inserted = await tx.execute<{ userId: string }>(sql`
        INSERT INTO household.memberships(household_id, user_id, role)
        VALUES (${current.householdId}, ${userId}, 'VIEWER')
        ON CONFLICT DO NOTHING RETURNING user_id AS "userId"
      `);
      if (!inserted.rows[0])
        throw new NotFoundException('Invitation not found');
      await tx.execute(sql`
        UPDATE household.invitations SET state = 'accepted', accepted_at = clock_timestamp()
        WHERE id = ${invitationId}
      `);
      await tx.execute(sql`
        INSERT INTO household.events(
          household_id, actor_user_id, kind, invitation_id, invitee_user_id
        ) VALUES (
          ${current.householdId}, ${userId}, 'invitation_accepted', ${invitationId}, ${userId}
        )
      `);
    });
  }
}
