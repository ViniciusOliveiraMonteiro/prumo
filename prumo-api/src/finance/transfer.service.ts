import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
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
export type TransferInput = {
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: string;
  currency: 'BRL';
  sourceEffectiveDate: string;
  destinationEffectiveDate: string;
  description: string;
};
export type TransferView = TransferInput & {
  eventId: string;
  version: number;
  type: 'INTERNAL_TRANSFER';
  sourceMovementId: string;
  destinationMovementId: string;
  sourceMovementAmountCents: string;
  destinationMovementAmountCents: string;
  sourceDateProvenance: 'MANUAL_USER';
  destinationDateProvenance: 'MANUAL_USER';
  recordedAt: string;
};
export type InTransitView = {
  date: string;
  currency: 'BRL';
  totalCents: string;
  items: { eventId: string; amountCents: string }[];
  nextCursor: string | null;
};

@Injectable()
export class TransferService {
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
    id: string,
  ): Promise<string> {
    const result = await tx.execute<{ openingDate: string }>(
      sql`SELECT opening_date::text AS "openingDate" FROM finance.accounts WHERE household_id = ${householdId} AND id = ${id}`,
    );
    if (!result.rows[0])
      throw new NotFoundException('Financial resource not found');
    return result.rows[0].openingDate;
  }

  create(
    userId: string,
    householdId: string,
    key: string,
    input: TransferInput,
  ): Promise<TransferView> {
    return this.authorized(userId, householdId, true, async (tx) => {
      const sourceOpening = await this.account(
        tx,
        householdId,
        input.sourceAccountId,
      );
      const destinationOpening = await this.account(
        tx,
        householdId,
        input.destinationAccountId,
      );
      if (
        input.sourceEffectiveDate < sourceOpening ||
        input.destinationEffectiveDate < destinationOpening
      )
        throw new BadRequestException('Transfer date precedes account opening');
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${householdId}:transfer:create:${key}`}, 0))`,
      );
      const prior = await tx.execute<{
        actor: string;
        same: boolean;
        response: TransferView;
      }>(
        sql`SELECT actor_user_id AS actor, request_payload = ${JSON.stringify(input)}::jsonb AS same, response FROM finance.transfer_requests WHERE household_id = ${householdId} AND operation = 'transfer:create' AND request_key = ${key}`,
      );
      if (prior.rows[0]) {
        if (prior.rows[0].actor !== userId || !prior.rows[0].same)
          throw new ConflictException('Idempotency key already used');
        return prior.rows[0].response;
      }
      const eventId = randomUUID();
      const sourceMovementId = randomUUID();
      const destinationMovementId = randomUUID();
      await tx.execute(
        sql`INSERT INTO finance.events(id, household_id, type) VALUES (${eventId}, ${householdId}, 'INTERNAL_TRANSFER')`,
      );
      await tx.execute(sql`INSERT INTO finance.event_versions(
        household_id, event_id, version, movement_id, account_id, amount_cents,
        currency, effective_date, description, state, date_provenance,
        recorded_by_user_id, event_type, destination_movement_id,
        destination_account_id, destination_effective_date)
        VALUES (${householdId}, ${eventId}, 1, ${sourceMovementId}, ${input.sourceAccountId},
        ${input.amountCents}::bigint, 'BRL', ${input.sourceEffectiveDate}::date,
        ${input.description}, 'APPLIED', 'MANUAL_USER', ${userId}, 'INTERNAL_TRANSFER',
        ${destinationMovementId}, ${input.destinationAccountId}, ${input.destinationEffectiveDate}::date)`);
      await tx.execute(sql`INSERT INTO finance.movements(
        id, household_id, event_id, version, account_id, amount_cents,
        effective_date, state, event_type, side)
        VALUES (${sourceMovementId}, ${householdId}, ${eventId}, 1,
        ${input.sourceAccountId}, -${input.amountCents}::bigint,
        ${input.sourceEffectiveDate}::date, 'APPLIED', 'INTERNAL_TRANSFER', 'TRANSFER_OUT')`);
      await tx.execute(sql`INSERT INTO finance.movements(
        id, household_id, event_id, version, account_id, amount_cents,
        effective_date, state, event_type, side)
        VALUES (${destinationMovementId}, ${householdId}, ${eventId}, 1,
        ${input.destinationAccountId}, ${input.amountCents}::bigint,
        ${input.destinationEffectiveDate}::date, 'APPLIED', 'INTERNAL_TRANSFER', 'TRANSFER_IN')`);
      const response = await this.transfer(tx, householdId, eventId);
      await tx.execute(sql`INSERT INTO finance.transfer_requests(
        household_id, request_key, actor_user_id, request_payload, event_id, response)
        VALUES (${householdId}, ${key}, ${userId}, ${JSON.stringify(input)}::jsonb,
        ${eventId}, ${JSON.stringify(response)}::jsonb)`);
      return response;
    });
  }

  private async transfer(
    tx: Tx,
    householdId: string,
    eventId: string,
  ): Promise<TransferView> {
    const result = await tx.execute<TransferView>(sql`SELECT
      e.id AS "eventId", e.type, v.version,
      v.account_id AS "sourceAccountId", v.destination_account_id AS "destinationAccountId",
      v.amount_cents::text AS "amountCents", v.currency,
      v.effective_date::text AS "sourceEffectiveDate",
      v.destination_effective_date::text AS "destinationEffectiveDate",
      v.description, src.id AS "sourceMovementId", dst.id AS "destinationMovementId",
      src.amount_cents::text AS "sourceMovementAmountCents",
      dst.amount_cents::text AS "destinationMovementAmountCents",
      v.date_provenance AS "sourceDateProvenance",
      v.date_provenance AS "destinationDateProvenance",
      to_char(v.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "recordedAt"
      FROM finance.events e
      JOIN finance.event_versions v ON (v.household_id, v.event_id, v.version)
        = (e.household_id, e.id, e.current_version)
      JOIN finance.movements src ON (src.household_id, src.id, src.version)
        = (v.household_id, v.movement_id, v.version)
      JOIN finance.movements dst ON (dst.household_id, dst.id, dst.version)
        = (v.household_id, v.destination_movement_id, v.version)
      WHERE e.household_id = ${householdId} AND e.id = ${eventId}
        AND e.type = 'INTERNAL_TRANSFER'`);
    if (!result.rows[0])
      throw new NotFoundException('Financial resource not found');
    return result.rows[0];
  }

  get(
    userId: string,
    householdId: string,
    eventId: string,
  ): Promise<TransferView> {
    return this.authorized(userId, householdId, false, (tx) =>
      this.transfer(tx, householdId, eventId),
    );
  }

  inTransit(
    userId: string,
    householdId: string,
    date: string,
    limit: number,
    cursor?: { date: string; eventId: string },
  ): Promise<InTransitView> {
    return this.authorized(userId, householdId, false, async (tx) => {
      const after = cursor
        ? sql`AND (effective_date, event_id) > (${cursor.date}::date, ${cursor.eventId}::uuid)`
        : sql``;
      const result = await tx.execute<{
        totalCents: string;
        eventId: string | null;
        amountCents: string | null;
        sourceEffectiveDate: string | null;
      }>(
        sql`WITH matching AS (
          SELECT e.id AS event_id, v.amount_cents, v.effective_date
          FROM finance.events e JOIN finance.event_versions v
          ON (v.household_id, v.event_id, v.version)
            = (e.household_id, e.id, e.current_version)
          WHERE e.household_id = ${householdId} AND e.type = 'INTERNAL_TRANSFER'
            AND v.effective_date <= ${date}::date
            AND v.destination_effective_date > ${date}::date
        ), total AS (
          SELECT COALESCE(sum(amount_cents::numeric), 0)::text AS cents FROM matching
        ), page AS (
          SELECT event_id, amount_cents, effective_date FROM matching
          WHERE true ${after}
          ORDER BY effective_date, event_id LIMIT ${limit + 1}
        )
        SELECT total.cents AS "totalCents", page.event_id AS "eventId",
          page.amount_cents::text AS "amountCents",
          page.effective_date::text AS "sourceEffectiveDate"
        FROM total LEFT JOIN page ON true
        ORDER BY page.effective_date, page.event_id`,
      );
      const page = result.rows
        .filter(
          (
            row,
          ): row is typeof row & {
            eventId: string;
            amountCents: string;
            sourceEffectiveDate: string;
          } =>
            row.eventId !== null &&
            row.amountCents !== null &&
            row.sourceEffectiveDate !== null,
        )
        .slice(0, limit);
      const last = page.at(-1);
      return {
        date,
        currency: 'BRL',
        totalCents: result.rows[0].totalCents,
        items: page.map(({ eventId, amountCents }) => ({
          eventId,
          amountCents,
        })),
        nextCursor:
          result.rows.length > limit && last
            ? `${last.sourceEffectiveDate}:${last.eventId}`
            : null,
      };
    });
  }
}
