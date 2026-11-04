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
import type { IncomeView } from './income.service.js';

type Tx = Parameters<Parameters<IdentityDatabase['db']['transaction']>[0]>[0];
export type CategoryInput = { name: string };
export type CategoryView = CategoryInput & {
  id: string;
  householdId: string;
  createdByUserId: string;
  createdAt: string;
};
export type ExpenseInput = {
  accountId: string;
  categoryId: string;
  amountCents: string;
  currency: 'BRL';
  effectiveDate: string;
  description: string;
};
export type ExpenseView = IncomeView & {
  categoryId: string;
  type: 'DIRECT_EXPENSE';
};

@Injectable()
export class ExpenseService {
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

  private async category(
    tx: Tx,
    householdId: string,
    id: string,
  ): Promise<CategoryView> {
    const rows = await tx.execute<CategoryView>(
      sql`SELECT id, household_id AS "householdId", name, created_by_user_id AS "createdByUserId", to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt" FROM finance.expense_categories WHERE household_id = ${householdId} AND id = ${id}`,
    );
    if (!rows.rows[0])
      throw new NotFoundException('Financial resource not found');
    return rows.rows[0];
  }

  createCategory(
    userId: string,
    householdId: string,
    key: string,
    input: CategoryInput,
  ): Promise<CategoryView> {
    return this.authorized(userId, householdId, true, async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${householdId}:category:create:${key}`}, 0))`,
      );
      const prior = await tx.execute<{
        actor: string;
        same: boolean;
        response: CategoryView;
      }>(
        sql`SELECT actor_user_id AS actor, request_payload = ${JSON.stringify(input)}::jsonb AS same, response FROM finance.category_requests WHERE household_id = ${householdId} AND request_key = ${key}`,
      );
      if (prior.rows[0]) {
        if (prior.rows[0].actor !== userId || !prior.rows[0].same)
          throw new ConflictException('Idempotency key already used');
        return prior.rows[0].response;
      }
      const categoryId = randomUUID();
      await tx.execute(
        sql`INSERT INTO finance.expense_categories(id, household_id, name, created_by_user_id) VALUES (${categoryId}, ${householdId}, ${input.name}, ${userId})`,
      );
      const result = await this.category(tx, householdId, categoryId);
      await tx.execute(sql`INSERT INTO finance.category_requests(household_id, request_key, actor_user_id, request_payload, category_id, response)
        VALUES (${householdId}, ${key}, ${userId}, ${JSON.stringify(input)}::jsonb, ${categoryId}, ${JSON.stringify(result)}::jsonb)`);
      return result;
    });
  }

  listCategories(userId: string, householdId: string): Promise<CategoryView[]> {
    return this.authorized(userId, householdId, false, async (tx) => {
      const result = await tx.execute<CategoryView>(
        sql`SELECT id, household_id AS "householdId", name, created_by_user_id AS "createdByUserId", to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt" FROM finance.expense_categories WHERE household_id = ${householdId} ORDER BY created_at, id`,
      );
      return result.rows;
    });
  }

  createExpense(
    userId: string,
    householdId: string,
    key: string,
    input: ExpenseInput,
  ): Promise<ExpenseView> {
    return this.authorized(userId, householdId, true, async (tx) => {
      const account = await tx.execute<{ openingDate: string }>(
        sql`SELECT opening_date::text AS "openingDate" FROM finance.accounts WHERE household_id = ${householdId} AND id = ${input.accountId}`,
      );
      if (!account.rows[0])
        throw new NotFoundException('Financial resource not found');
      await this.category(tx, householdId, input.categoryId);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${householdId}:expense:create:${key}`}, 0))`,
      );
      const prior = await tx.execute<{
        actor: string;
        same: boolean;
        response: ExpenseView;
      }>(
        sql`SELECT actor_user_id AS actor, request_payload = ${JSON.stringify(input)}::jsonb AS same, response FROM finance.expense_requests WHERE household_id = ${householdId} AND request_key = ${key}`,
      );
      if (prior.rows[0]) {
        if (prior.rows[0].actor !== userId || !prior.rows[0].same)
          throw new ConflictException('Idempotency key already used');
        return prior.rows[0].response;
      }
      const eventId = randomUUID();
      const movementId = randomUUID();
      const state =
        input.effectiveDate < account.rows[0].openingDate
          ? 'PENDING_PRE_OPENING'
          : 'APPLIED';
      await tx.execute(
        sql`INSERT INTO finance.events(id, household_id, type) VALUES (${eventId}, ${householdId}, 'DIRECT_EXPENSE')`,
      );
      await tx.execute(sql`INSERT INTO finance.event_versions(household_id, event_id, version, movement_id, account_id, amount_cents, currency, effective_date, description, state, date_provenance, recorded_by_user_id, event_type, category_id)
        VALUES (${householdId}, ${eventId}, 1, ${movementId}, ${input.accountId}, ${input.amountCents}::bigint, 'BRL', ${input.effectiveDate}::date, ${input.description}, ${state}, 'MANUAL_USER', ${userId}, 'DIRECT_EXPENSE', ${input.categoryId})`);
      await tx.execute(sql`INSERT INTO finance.movements(id, household_id, event_id, version, account_id, amount_cents, effective_date, state, event_type)
        VALUES (${movementId}, ${householdId}, ${eventId}, 1, ${input.accountId}, -${input.amountCents}::bigint, ${input.effectiveDate}::date, ${state}, 'DIRECT_EXPENSE')`);
      const result = await this.expense(tx, householdId, eventId);
      await tx.execute(sql`INSERT INTO finance.expense_requests(household_id, request_key, actor_user_id, request_payload, event_id, response)
        VALUES (${householdId}, ${key}, ${userId}, ${JSON.stringify(input)}::jsonb, ${eventId}, ${JSON.stringify(result)}::jsonb)`);
      return result;
    });
  }

  private async expense(
    tx: Tx,
    householdId: string,
    eventId: string,
  ): Promise<ExpenseView> {
    const result =
      await tx.execute<ExpenseView>(sql`SELECT v.event_id AS "eventId", v.movement_id AS "movementId", v.version, e.type,
      v.category_id AS "categoryId", m.amount_cents::text AS "movementAmountCents", v.account_id AS "accountId", v.amount_cents::text AS "amountCents", v.currency,
      v.effective_date::text AS "effectiveDate", v.description, v.state,
      CASE WHEN v.state = 'PENDING_PRE_OPENING' THEN 'PRE_OPENING' ELSE NULL END AS "pendingReason",
      v.date_provenance AS "dateProvenance", to_char(v.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "recordedAt", m.sequence::text AS sequence
      FROM finance.events e JOIN finance.event_versions v ON (v.household_id, v.event_id, v.version) = (e.household_id, e.id, e.current_version)
      JOIN finance.movements m ON (m.household_id, m.id, m.version) = (v.household_id, v.movement_id, v.version)
      WHERE e.household_id = ${householdId} AND e.id = ${eventId} AND e.type = 'DIRECT_EXPENSE'`);
    if (!result.rows[0])
      throw new NotFoundException('Financial resource not found');
    return result.rows[0];
  }
}
