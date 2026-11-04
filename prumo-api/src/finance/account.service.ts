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

export type AccountInput = {
  name: string;
  currency: 'BRL';
  openingDate: string;
  openingBalanceCents: string;
};

export type AccountView = AccountInput & { id: string; openingVersion: number };
type FinanceAction = 'finance:read' | 'finance:write';
type FinanceContext = {
  userId: string;
  householdId: string;
  action: FinanceAction;
};
type Role = 'OWNER' | 'MEMBER' | 'VIEWER';

@Injectable()
export class AccountService {
  constructor(private readonly database: IdentityDatabase) {}

  async create(
    userId: string,
    householdId: string,
    requestKey: string,
    input: AccountInput,
  ): Promise<AccountView> {
    return this.withSafeDatabaseErrors(() =>
      this.database.db.transaction(async (tx) => {
        const membership = await tx.execute<{ role: Role }>(sql`
        SELECT role FROM household.memberships
        WHERE household_id = ${householdId} AND user_id = ${userId} AND active
        FOR SHARE
      `);
        const context = this.authorize(
          userId,
          householdId,
          'finance:write',
          membership.rows[0]?.role,
        );
        // The lock serializes retries, including retries from separate processes.
        // A hash collision only serializes unrelated keys; the exact key remains
        // the primary key in account_requests.
        await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`${context.householdId}:account:create:${requestKey}`}, 0)
        )
      `);
        const prior = await tx.execute<{
          actorUserId: string;
          samePayload: boolean;
          response: AccountView;
        }>(sql`
        SELECT actor_user_id AS "actorUserId",
               request_payload = ${JSON.stringify(input)}::jsonb AS "samePayload",
               response
        FROM finance.account_requests
        WHERE household_id = ${context.householdId}
          AND operation = 'account:create' AND request_key = ${requestKey}
      `);
        if (prior.rows[0]) {
          if (
            prior.rows[0].actorUserId !== context.userId ||
            !prior.rows[0].samePayload
          ) {
            throw new ConflictException('Idempotency key already used');
          }
          return prior.rows[0].response;
        }

        const created = await tx.execute<AccountView>(sql`
        INSERT INTO finance.accounts (
          household_id, created_by_user_id, name, currency,
          opening_date, opening_balance_cents
        ) VALUES (
          ${context.householdId}, ${context.userId}, ${input.name},
          ${input.currency}, ${input.openingDate}::date,
          ${input.openingBalanceCents}::bigint
        )
        RETURNING id, name, currency, opening_version AS "openingVersion", opening_date AS "openingDate",
                  opening_balance_cents::text AS "openingBalanceCents"
      `);
        const account = created.rows[0];
        await tx.execute(sql`
        INSERT INTO finance.account_requests (
          household_id, operation, request_key, actor_user_id,
          request_payload, account_id, response
        ) VALUES (
          ${context.householdId}, 'account:create', ${requestKey},
          ${context.userId}, ${JSON.stringify(input)}::jsonb, ${account.id},
          ${JSON.stringify(account)}::jsonb
        )
      `);
        return account;
      }),
    );
  }

  async list(userId: string, householdId: string): Promise<AccountView[]> {
    return this.withSafeDatabaseErrors(async () => {
      const context = await this.readContext(userId, householdId);
      const result = await this.database.db.execute<AccountView>(sql`
        SELECT id, name, currency, opening_version AS "openingVersion", opening_date AS "openingDate",
               opening_balance_cents::text AS "openingBalanceCents"
        FROM finance.accounts
        WHERE household_id = ${context.householdId}
        ORDER BY created_at, id
      `);
      return result.rows;
    });
  }

  async get(
    userId: string,
    householdId: string,
    accountId: string,
  ): Promise<AccountView> {
    return this.withSafeDatabaseErrors(async () => {
      const context = await this.readContext(userId, householdId);
      const result = await this.database.db.execute<AccountView>(sql`
        SELECT id, name, currency, opening_version AS "openingVersion", opening_date AS "openingDate",
               opening_balance_cents::text AS "openingBalanceCents"
        FROM finance.accounts
        WHERE household_id = ${context.householdId} AND id = ${accountId}
      `);
      if (!result.rows[0])
        throw new NotFoundException('Financial resource not found');
      return result.rows[0];
    });
  }

  private async readContext(
    userId: string,
    householdId: string,
  ): Promise<FinanceContext> {
    const membership = await this.database.db.execute<{ role: Role }>(sql`
      SELECT role FROM household.memberships
      WHERE household_id = ${householdId} AND user_id = ${userId} AND active
    `);
    return this.authorize(
      userId,
      householdId,
      'finance:read',
      membership.rows[0]?.role,
    );
  }

  private authorize(
    userId: string,
    householdId: string,
    action: FinanceAction,
    role?: Role,
  ): FinanceContext {
    if (!role) throw new NotFoundException('Financial resource not found');
    if (action === 'finance:write' && role === 'VIEWER')
      throw new ForbiddenException('Financial action denied');
    return { userId, householdId, action };
  }

  private async withSafeDatabaseErrors<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Financial operation failed');
    }
  }
}
