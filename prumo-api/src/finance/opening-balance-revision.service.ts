import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IdentityDatabase } from '../identity/identity.database.js';

type Tx = Parameters<Parameters<IdentityDatabase['db']['transaction']>[0]>[0];
export type OpeningRevisionInput = {
  expectedVersion: number;
  openingBalanceCents: string;
  reason: string;
  openingDate?: string;
};
export type OpeningRevisionView = {
  revisionId: string | null;
  accountId: string;
  version: number;
  openingDate: string;
  previousOpeningDate?: string | null;
  previousBalanceCents: string | null;
  openingBalanceCents: string;
  reason: string | null;
  actorUserId: string;
  revisedAt: string;
};
export type OpeningRevisionPage = {
  items: OpeningRevisionView[];
  nextCursor: number | null;
};

@Injectable()
export class OpeningBalanceRevisionService {
  constructor(private readonly database: IdentityDatabase) {}

  private async authorized<T>(
    userId: string,
    householdId: string,
    write: boolean,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.database.db.transaction(async (tx) => {
        const membership = await tx.execute<{ role: string }>(sql`
          SELECT role FROM household.memberships
          WHERE household_id = ${householdId} AND user_id = ${userId} AND active
          FOR SHARE`);
        if (!membership.rows[0])
          throw new NotFoundException('Financial resource not found');
        if (write && membership.rows[0].role === 'VIEWER')
          throw new ForbiddenException('Financial action denied');
        return work(tx);
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Financial operation failed');
    }
  }

  revise(
    userId: string,
    householdId: string,
    accountId: string,
    key: string,
    input: OpeningRevisionInput,
  ): Promise<OpeningRevisionView> {
    return this.authorized(userId, householdId, true, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`${householdId}:account:opening-balance:revise:${key}`}, 0)
        )`);
      const account = await tx.execute<{
        openingVersion: number;
        openingDate: string;
        openingBalanceCents: string;
      }>(sql`
        SELECT opening_version AS "openingVersion", opening_date::text AS "openingDate",
          opening_balance_cents::text AS "openingBalanceCents"
        FROM finance.accounts WHERE household_id = ${householdId} AND id = ${accountId}
        FOR UPDATE`);
      if (!account.rows[0])
        throw new NotFoundException('Financial resource not found');
      const prior = await tx.execute<{
        actorUserId: string;
        accountId: string;
        samePayload: boolean;
        response: OpeningRevisionView;
      }>(sql`
        SELECT actor_user_id AS "actorUserId", account_id AS "accountId",
          request_payload = ${JSON.stringify(input)}::jsonb AS "samePayload", response
        FROM finance.opening_balance_revision_requests
        WHERE household_id = ${householdId} AND operation = 'account:opening-balance:revise'
          AND request_key = ${key}`);
      if (prior.rows[0]) {
        if (
          prior.rows[0].actorUserId !== userId ||
          prior.rows[0].accountId !== accountId ||
          !prior.rows[0].samePayload
        )
          throw new ConflictException('Idempotency key already used');
        return prior.rows[0].response;
      }
      const current = account.rows[0];
      if (current.openingVersion !== input.expectedVersion)
        throw new ConflictException('Opening balance version changed');
      const openingDate = input.openingDate ?? current.openingDate;
      const changed = await tx.execute<OpeningRevisionView>(sql`
        INSERT INTO finance.opening_balance_revisions (
          household_id, account_id, previous_version, version, previous_opening_date, opening_date,
          previous_balance_cents, opening_balance_cents, reason, actor_user_id
        ) VALUES (
          ${householdId}, ${accountId}, ${current.openingVersion},
          ${current.openingVersion + 1}, ${current.openingDate}::date, ${openingDate}::date,
          ${current.openingBalanceCents}::bigint, ${input.openingBalanceCents}::bigint,
          ${input.reason}, ${userId}
        ) RETURNING id AS "revisionId", account_id AS "accountId", version,
          previous_opening_date::text AS "previousOpeningDate", opening_date::text AS "openingDate",
          previous_balance_cents::text AS "previousBalanceCents",
          opening_balance_cents::text AS "openingBalanceCents", reason,
          actor_user_id AS "actorUserId",
          to_char(revised_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "revisedAt"`);
      await tx.execute(sql`
        UPDATE finance.accounts SET opening_balance_cents = ${input.openingBalanceCents}::bigint,
          opening_date = ${openingDate}::date, opening_version = ${current.openingVersion + 1}
        WHERE household_id = ${householdId} AND id = ${accountId}`);
      const result = changed.rows[0];
      await tx.execute(sql`
        INSERT INTO finance.movement_opening_transitions (
          household_id, account_id, movement_id, movement_version, event_id,
          revision_id, previous_state, state)
        SELECT m.household_id, m.account_id, m.id, m.version, m.event_id,
          ${result.revisionId}::uuid, m.state,
          CASE WHEN m.effective_date < ${openingDate}::date
            THEN 'PENDING_PRE_OPENING' ELSE 'APPLIED' END
        FROM finance.movements m JOIN finance.events e
          ON (e.household_id, e.id, e.current_version) = (m.household_id, m.event_id, m.version)
        WHERE m.household_id = ${householdId} AND m.account_id = ${accountId}
          AND m.state <> CASE WHEN m.effective_date < ${openingDate}::date
            THEN 'PENDING_PRE_OPENING' ELSE 'APPLIED' END`);
      await tx.execute(sql`
        UPDATE finance.movements m SET state = t.state
        FROM finance.movement_opening_transitions t
        WHERE (t.household_id, t.movement_id, t.movement_version)
          = (m.household_id, m.id, m.version)
          AND t.revision_id = ${result.revisionId}::uuid`);
      await tx.execute(sql`
        INSERT INTO finance.opening_balance_revision_requests (
          household_id, request_key, actor_user_id, account_id,
          request_payload, revision_id, response
        ) VALUES (${householdId}, ${key}, ${userId}, ${accountId},
          ${JSON.stringify(input)}::jsonb, ${result.revisionId}, ${JSON.stringify(result)}::jsonb)`);
      return result;
    });
  }

  list(
    userId: string,
    householdId: string,
    accountId: string,
    limit: number,
    afterVersion: number,
  ): Promise<OpeningRevisionPage> {
    return this.authorized(userId, householdId, false, async (tx) => {
      const account = await tx.execute<{ exists: boolean }>(sql`
        SELECT true AS exists FROM finance.accounts
        WHERE household_id = ${householdId} AND id = ${accountId}`);
      if (!account.rows[0])
        throw new NotFoundException('Financial resource not found');
      const rows = await tx.execute<OpeningRevisionView>(sql`
        SELECT NULL::uuid AS "revisionId", a.id AS "accountId", 1 AS version,
          COALESCE(first.previous_opening_date, a.opening_date)::text AS "openingDate",
          NULL::text AS "previousOpeningDate", NULL::text AS "previousBalanceCents",
          COALESCE(first.previous_balance_cents, a.opening_balance_cents)::text AS "openingBalanceCents",
          NULL::text AS reason, a.created_by_user_id AS "actorUserId",
          to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "revisedAt"
        FROM finance.accounts a
        LEFT JOIN LATERAL (
          SELECT previous_balance_cents, previous_opening_date FROM finance.opening_balance_revisions r
          WHERE r.household_id = a.household_id AND r.account_id = a.id AND r.version = 2
        ) first ON true
        WHERE a.household_id = ${householdId} AND a.id = ${accountId} AND ${afterVersion} < 1
        UNION ALL
        SELECT r.id, r.account_id, r.version, r.opening_date::text,
          r.previous_opening_date::text,
          r.previous_balance_cents::text, r.opening_balance_cents::text,
          r.reason, r.actor_user_id,
          to_char(r.revised_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        FROM finance.opening_balance_revisions r
        WHERE r.household_id = ${householdId} AND r.account_id = ${accountId}
          AND r.version > ${afterVersion}
        ORDER BY version LIMIT ${limit + 1}`);
      const items = rows.rows.slice(0, limit);
      return {
        items,
        nextCursor: rows.rows.length > limit ? items.at(-1)!.version : null,
      };
    });
  }
}
