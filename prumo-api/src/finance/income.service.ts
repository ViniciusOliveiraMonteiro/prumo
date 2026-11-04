import { randomUUID } from 'node:crypto';
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
export type IncomeInput = {
  accountId: string;
  amountCents: string;
  currency: 'BRL';
  effectiveDate: string;
  description: string;
};
export type IncomeView = IncomeInput & {
  eventId: string;
  movementId: string;
  version: number;
  type: 'RECEIVED_INCOME' | 'DIRECT_EXPENSE';
  categoryId: string | null;
  movementAmountCents: string;
  state: 'APPLIED' | 'PENDING_PRE_OPENING';
  pendingReason: 'PRE_OPENING' | null;
  dateProvenance: 'MANUAL_USER';
  recordedAt: string;
  sequence: string;
};
export type BalanceView = {
  currency: 'BRL';
  date: string;
  openingDate: string;
  openingBalanceCents: string;
  calculable: boolean;
  balanceCents: string | null;
  negativeBalance: boolean | null;
};
export type MovementPage = { items: IncomeView[]; nextCursor: string | null };
const projection = sql`v.event_id AS "eventId", v.movement_id AS "movementId", v.version,
  e.type, v.category_id AS "categoryId", m.amount_cents::text AS "movementAmountCents",
  v.account_id AS "accountId", v.amount_cents::text AS "amountCents", v.currency,
  v.effective_date::text AS "effectiveDate", v.description, v.state,
  CASE WHEN v.state = 'PENDING_PRE_OPENING' THEN 'PRE_OPENING' ELSE NULL END AS "pendingReason",
  v.date_provenance AS "dateProvenance", to_char(v.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "recordedAt", m.sequence::text AS sequence`;

@Injectable()
export class IncomeService {
  constructor(private readonly database: IdentityDatabase) {}

  private async authorized<T>(
    userId: string,
    householdId: string,
    write: boolean,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.database.db.transaction(async (tx) => {
        const membership = await tx.execute<{ role: string }>(
          sql`SELECT role FROM household.memberships WHERE household_id = ${householdId} AND user_id = ${userId} AND active FOR SHARE`,
        );
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

  private async account(
    tx: Tx,
    householdId: string,
    accountId: string,
  ): Promise<string> {
    const result = await tx.execute<{ openingDate: string }>(
      sql`SELECT opening_date::text AS "openingDate" FROM finance.accounts WHERE household_id = ${householdId} AND id = ${accountId}`,
    );
    if (!result.rows[0])
      throw new NotFoundException('Financial resource not found');
    return result.rows[0].openingDate;
  }

  create(
    userId: string,
    householdId: string,
    key: string,
    input: IncomeInput,
  ): Promise<IncomeView> {
    return this.authorized(userId, householdId, true, async (tx) => {
      const openingDate = await this.account(tx, householdId, input.accountId);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${householdId}:income:create:${key}`}, 0))`,
      );
      const prior = await tx.execute<{
        actor: string;
        same: boolean;
        response: IncomeView;
      }>(
        sql`SELECT actor_user_id AS actor, request_payload = ${JSON.stringify(input)}::jsonb AS same, response FROM finance.income_requests WHERE household_id = ${householdId} AND operation = 'income:create' AND request_key = ${key}`,
      );
      if (prior.rows[0]) {
        if (prior.rows[0].actor !== userId || !prior.rows[0].same)
          throw new ConflictException('Idempotency key already used');
        return prior.rows[0].response;
      }
      const eventId = randomUUID();
      const movementId = randomUUID();
      const state =
        input.effectiveDate < openingDate ? 'PENDING_PRE_OPENING' : 'APPLIED';
      await tx.execute(
        sql`INSERT INTO finance.events(id, household_id, type) VALUES (${eventId}, ${householdId}, 'RECEIVED_INCOME')`,
      );
      await tx.execute(sql`INSERT INTO finance.event_versions(household_id, event_id, version, movement_id, account_id, amount_cents, currency, effective_date, description, state, date_provenance, recorded_by_user_id)
        VALUES (${householdId}, ${eventId}, 1, ${movementId}, ${input.accountId}, ${input.amountCents}::bigint, 'BRL', ${input.effectiveDate}::date, ${input.description}, ${state}, 'MANUAL_USER', ${userId})`);
      await tx.execute(sql`INSERT INTO finance.movements(id, household_id, event_id, version, account_id, amount_cents, effective_date, state)
        VALUES (${movementId}, ${householdId}, ${eventId}, 1, ${input.accountId}, ${input.amountCents}::bigint, ${input.effectiveDate}::date, ${state})`);
      const result = await this.event(tx, householdId, eventId);
      await tx.execute(sql`INSERT INTO finance.income_requests(household_id, operation, request_key, actor_user_id, request_payload, event_id, response)
        VALUES (${householdId}, 'income:create', ${key}, ${userId}, ${JSON.stringify(input)}::jsonb, ${eventId}, ${JSON.stringify(result)}::jsonb)`);
      return result;
    });
  }

  private async event(
    tx: Tx,
    householdId: string,
    eventId: string,
  ): Promise<IncomeView> {
    const result = await tx.execute<IncomeView>(
      sql`SELECT ${projection} FROM finance.events e JOIN finance.event_versions v ON (v.household_id, v.event_id, v.version) = (e.household_id, e.id, e.current_version) JOIN finance.movements m ON (m.household_id, m.id, m.version) = (v.household_id, v.movement_id, v.version) WHERE e.household_id = ${householdId} AND e.id = ${eventId}`,
    );
    if (!result.rows[0])
      throw new NotFoundException('Financial resource not found');
    return result.rows[0];
  }

  get(
    userId: string,
    householdId: string,
    eventId: string,
  ): Promise<IncomeView> {
    return this.authorized(userId, householdId, false, (tx) =>
      this.event(tx, householdId, eventId),
    );
  }

  balance(
    userId: string,
    householdId: string,
    accountId: string,
    date: string,
  ): Promise<BalanceView> {
    return this.authorized(userId, householdId, false, async (tx) => {
      const result =
        await tx.execute<BalanceView>(sql`SELECT a.currency, ${date}::text AS date, a.opening_date::text AS "openingDate", a.opening_balance_cents::text AS "openingBalanceCents",
        ${date}::date >= a.opening_date AS calculable,
        CASE WHEN ${date}::date < a.opening_date THEN NULL ELSE (a.opening_balance_cents::numeric + COALESCE((
          SELECT sum(m.amount_cents::numeric) FROM finance.movements m JOIN finance.events e ON (e.household_id, e.id, e.current_version) = (m.household_id, m.event_id, m.version)
          WHERE m.household_id = a.household_id AND m.account_id = a.id AND m.state = 'APPLIED' AND m.effective_date BETWEEN a.opening_date AND ${date}::date
        ), 0))::text END AS "balanceCents" FROM finance.accounts a WHERE a.household_id = ${householdId} AND a.id = ${accountId}`);
      if (!result.rows[0])
        throw new NotFoundException('Financial resource not found');
      const balance = result.rows[0];
      return {
        ...balance,
        negativeBalance:
          balance.balanceCents === null
            ? null
            : BigInt(balance.balanceCents) < 0n,
      };
    });
  }

  movements(
    userId: string,
    householdId: string,
    accountId: string,
    limit: number,
    cursor?: { date: string; sequence: string },
  ): Promise<MovementPage> {
    return this.authorized(userId, householdId, false, async (tx) => {
      await this.account(tx, householdId, accountId);
      const after = cursor
        ? sql`AND (m.effective_date, m.sequence) > (${cursor.date}::date, ${cursor.sequence}::bigint)`
        : sql``;
      const result =
        await tx.execute<IncomeView>(sql`SELECT ${projection} FROM finance.movements m JOIN finance.events e ON (e.household_id, e.id, e.current_version) = (m.household_id, m.event_id, m.version) JOIN finance.event_versions v ON (v.household_id, v.event_id, v.version) = (m.household_id, m.event_id, m.version)
        WHERE m.household_id = ${householdId} AND m.account_id = ${accountId} ${after} ORDER BY m.effective_date, m.sequence LIMIT ${limit + 1}`);
      const items = result.rows.slice(0, limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          result.rows.length > limit && last
            ? `${last.effectiveDate}:${last.sequence}`
            : null,
      };
    });
  }
}
