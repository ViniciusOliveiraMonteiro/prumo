import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IdentityDatabase } from '../identity/identity.database.js';

export type HouseholdRole = 'OWNER' | 'MEMBER' | 'VIEWER';
export type HouseholdView = { id: string; name: string; role: HouseholdRole };
export type MembershipView = { userId: string; role: HouseholdRole };
export type HouseholdAction =
  'household:read' | 'household:rename' | 'household:manage-memberships';
type AuthorizedHousehold = {
  userId: string;
  householdId: string;
  action: HouseholdAction;
  role: HouseholdRole;
};

@Injectable()
export class HouseholdService {
  constructor(private readonly database: IdentityDatabase) {}

  async create(userId: string, name: string): Promise<HouseholdView> {
    return this.database.db.transaction(async (tx) => {
      const created = await tx.execute<{ id: string; name: string }>(sql`
        INSERT INTO household.households(name) VALUES (${name}) RETURNING id, name
      `);
      const household = created.rows[0];
      await tx.execute(sql`
        INSERT INTO household.memberships(household_id, user_id, role)
        VALUES (${household.id}, ${userId}, 'OWNER')
      `);
      await tx.execute(sql`
        INSERT INTO household.events(household_id, actor_user_id, kind)
        VALUES (${household.id}, ${userId}, 'created')
      `);
      return { ...household, role: 'OWNER' };
    });
  }

  async list(userId: string): Promise<HouseholdView[]> {
    const result = await this.database.db.execute<HouseholdView>(sql`
      SELECT h.id, h.name, m.role
      FROM household.memberships m
      JOIN household.households h ON h.id = m.household_id
      WHERE m.user_id = ${userId} AND m.active
      ORDER BY h.created_at, h.id
    `);
    return result.rows;
  }

  async get(userId: string, householdId: string): Promise<HouseholdView> {
    const result = await this.database.db.execute<HouseholdView>(sql`
      SELECT h.id, h.name, m.role
      FROM household.memberships m
      JOIN household.households h ON h.id = m.household_id
      WHERE m.user_id = ${userId} AND m.household_id = ${householdId} AND m.active
    `);
    const found = result.rows[0];
    if (!found) throw new NotFoundException('Household not found');
    this.authorize(userId, householdId, 'household:read', found?.role);
    return found;
  }

  async rename(
    userId: string,
    householdId: string,
    name: string,
  ): Promise<HouseholdView> {
    return this.database.db.transaction(async (tx) => {
      const membership = await tx.execute<{ role: HouseholdRole }>(sql`
        SELECT role FROM household.memberships
        WHERE user_id = ${userId} AND household_id = ${householdId} AND active
        FOR SHARE
      `);
      const context = this.authorize(
        userId,
        householdId,
        'household:rename',
        membership.rows[0]?.role,
      );
      const updated = await tx.execute<{ id: string; name: string }>(sql`
        UPDATE household.households SET name = ${name}, updated_at = now()
        WHERE id = ${context.householdId} RETURNING id, name
      `);
      if (!updated.rows[0]) throw new NotFoundException('Household not found');
      await tx.execute(sql`
        INSERT INTO household.events(household_id, actor_user_id, kind)
        VALUES (${context.householdId}, ${context.userId}, 'renamed')
      `);
      return { ...updated.rows[0], role: context.role };
    });
  }

  async listMemberships(
    userId: string,
    householdId: string,
  ): Promise<MembershipView[]> {
    return this.database.db.transaction(async (tx) => {
      const actor = await tx.execute<{ role: HouseholdRole }>(sql`
        SELECT role FROM household.memberships
        WHERE household_id = ${householdId} AND user_id = ${userId} AND active
        FOR SHARE
      `);
      this.authorize(
        userId,
        householdId,
        'household:manage-memberships',
        actor.rows[0]?.role,
      );
      const members = await tx.execute<MembershipView>(sql`
        SELECT user_id AS "userId", role FROM household.memberships
        WHERE household_id = ${householdId} AND active
        ORDER BY user_id
      `);
      return members.rows;
    });
  }

  async revokeMembership(
    userId: string,
    householdId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      // Every revocation locks the same rows in the same order. Rename also
      // locks membership before touching the household; keep that order here.
      const members = await tx.execute<{
        userId: string;
        role: HouseholdRole;
        active: boolean;
      }>(sql`
        SELECT user_id AS "userId", role, active FROM household.memberships
        WHERE household_id = ${householdId}
          AND user_id IN (${userId}, ${targetUserId})
        ORDER BY user_id
        FOR UPDATE
      `);
      const actor = members.rows.find((member) => member.userId === userId);
      this.authorize(
        userId,
        householdId,
        'household:manage-memberships',
        actor?.active ? actor.role : undefined,
      );
      const target = members.rows.find(
        (member) => member.userId === targetUserId,
      );
      if (!target) throw new NotFoundException('Membership not found');
      if (target.role === 'OWNER')
        throw new ConflictException('Owner membership cannot be revoked');
      if (!target.active) return;
      await tx.execute(sql`
        UPDATE household.memberships SET active = false
        WHERE household_id = ${householdId} AND user_id = ${targetUserId}
      `);
      await tx.execute(sql`
        INSERT INTO household.events(
          household_id, actor_user_id, kind, target_user_id, previous_role
        ) VALUES (
          ${householdId}, ${userId}, 'membership_revoked', ${targetUserId}, ${target.role}
        )
      `);
    });
  }

  private authorize(
    userId: string,
    householdId: string,
    action: HouseholdAction,
    role?: HouseholdRole,
  ): AuthorizedHousehold {
    if (!role) throw new NotFoundException('Household not found');
    if (action !== 'household:read' && role !== 'OWNER')
      throw new ForbiddenException('Household action denied');
    return { userId, householdId, action, role };
  }
}
