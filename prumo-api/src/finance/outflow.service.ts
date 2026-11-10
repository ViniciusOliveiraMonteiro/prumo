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
export type OutflowInput = {
  sourceAccountId: string;
  amountCents: string;
  currency: 'BRL';
  sourceEffectiveDate: string;
  description: string;
};
export type ArrivalInput = {
  expectedVersion: number;
  destinationAccountId: string;
  destinationEffectiveDate: string;
  reason: string;
};
export type OutflowView = OutflowInput & {
  eventId: string;
  version: number;
  type: string;
  sourceMovementId: string;
  sourceMovementAmountCents: string;
  sourceState: string;
  sourceDateProvenance: string;
  recordedAt: string;
  recordedByUserId: string;
  destinationAccountId: string | null;
  destinationMovementId: string | null;
  destinationEffectiveDate: string | null;
  destinationState: string | null;
  destinationMovementAmountCents: string | null;
  resolution: {
    actorUserId: string;
    reason: string;
    recordedAt: string;
    previousVersion: number;
  } | null;
};
@Injectable()
export class OutflowService {
  constructor(private readonly database: IdentityDatabase) {}
  private async authorized<T>(
    userId: string,
    householdId: string,
    write: boolean,
    work: (tx: Tx) => Promise<T>,
    snapshot = false,
  ): Promise<T> {
    try {
      return await this.database.db.transaction(
        async (tx) => {
          const membership = await tx.execute<{ role: string }>(
            sql`SELECT role FROM household.memberships WHERE household_id = ${householdId} AND user_id = ${userId} AND active FOR SHARE`,
          );
          if (!membership.rows[0])
            throw new NotFoundException('Financial resource not found');
          if (write && membership.rows[0].role === 'VIEWER')
            throw new ForbiddenException('Financial action denied');
          return work(tx);
        },
        snapshot ? { isolationLevel: 'repeatable read' } : undefined,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Financial operation failed');
    }
  }
  private async view(
    tx: Tx,
    householdId: string,
    eventId: string,
  ): Promise<OutflowView> {
    const result =
      await tx.execute<OutflowView>(sql`SELECT e.id AS "eventId", e.type, v.version,
   v.account_id AS "sourceAccountId", v.amount_cents::text AS "amountCents", v.currency,
   v.effective_date::text AS "sourceEffectiveDate", v.description, v.movement_id AS "sourceMovementId",
   src.amount_cents::text AS "sourceMovementAmountCents", src.state AS "sourceState", v.date_provenance AS "sourceDateProvenance",
   to_char(v.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "recordedAt", v.recorded_by_user_id AS "recordedByUserId",
   v.destination_account_id AS "destinationAccountId", v.destination_movement_id AS "destinationMovementId",
   v.destination_effective_date::text AS "destinationEffectiveDate", dst.state AS "destinationState", dst.amount_cents::text AS "destinationMovementAmountCents",
   CASE WHEN l.event_id IS NULL THEN NULL ELSE jsonb_build_object('actorUserId', l.actor_user_id, 'reason', l.reason, 'recordedAt', to_char(l.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'previousVersion', l.previous_version) END AS resolution
   FROM finance.events e JOIN finance.event_versions v ON (v.household_id,v.event_id,v.version) = (e.household_id,e.id,e.current_version)
   JOIN finance.movements src ON (src.household_id,src.id,src.version) = (v.household_id,v.movement_id,v.version)
   LEFT JOIN finance.movements dst ON (dst.household_id,dst.id,dst.version) = (v.household_id,v.destination_movement_id,v.version)
   LEFT JOIN finance.arrival_links l ON (l.household_id,l.event_id,l.version) = (v.household_id,v.event_id,v.version)
   WHERE e.household_id = ${householdId} AND e.id = ${eventId} AND EXISTS (SELECT 1 FROM finance.event_versions initial WHERE initial.household_id = e.household_id AND initial.event_id = e.id AND initial.version = 1 AND initial.event_type = 'UNCLASSIFIED_OUTFLOW')`);
    if (!result.rows[0])
      throw new NotFoundException('Financial resource not found');
    return result.rows[0];
  }
  get(userId: string, householdId: string, eventId: string) {
    return this.authorized(userId, householdId, false, (tx) =>
      this.view(tx, householdId, eventId),
    );
  }
  create(
    userId: string,
    householdId: string,
    key: string,
    input: OutflowInput,
  ) {
    return this.command(
      userId,
      householdId,
      key,
      'outflow:create',
      input,
      async (tx) => {
        const account = await tx.execute<{ openingDate: string }>(
          sql`SELECT opening_date::text AS "openingDate" FROM finance.accounts WHERE household_id = ${householdId} AND id = ${input.sourceAccountId} FOR UPDATE`,
        );
        if (!account.rows[0])
          throw new NotFoundException('Financial resource not found');
        const eventId = randomUUID(),
          movementId = randomUUID();
        const state =
          input.sourceEffectiveDate < account.rows[0].openingDate
            ? 'PENDING_PRE_OPENING'
            : 'APPLIED';
        await tx.execute(
          sql`INSERT INTO finance.events(id,household_id,type) VALUES (${eventId},${householdId},'UNCLASSIFIED_OUTFLOW')`,
        );
        await tx.execute(
          sql`INSERT INTO finance.event_versions(household_id,event_id,version,movement_id,account_id,amount_cents,currency,effective_date,description,state,date_provenance,recorded_by_user_id,event_type) VALUES (${householdId},${eventId},1,${movementId},${input.sourceAccountId},${input.amountCents}::bigint,'BRL',${input.sourceEffectiveDate}::date,${input.description},${state},'MANUAL_USER',${userId},'UNCLASSIFIED_OUTFLOW')`,
        );
        await tx.execute(
          sql`INSERT INTO finance.movements(id,household_id,event_id,version,account_id,amount_cents,effective_date,state,event_type) VALUES (${movementId},${householdId},${eventId},1,${input.sourceAccountId},-${input.amountCents}::bigint,${input.sourceEffectiveDate}::date,${state},'UNCLASSIFIED_OUTFLOW')`,
        );
        return this.view(tx, householdId, eventId);
      },
    );
  }
  link(
    userId: string,
    householdId: string,
    eventId: string,
    key: string,
    input: ArrivalInput,
  ) {
    return this.command(
      userId,
      householdId,
      key,
      'outflow:link',
      { eventId, ...input },
      async (tx) => {
        // Lock accounts by UUID before the event, matching opening revisions and manual transfers.
        const initial = await this.view(tx, householdId, eventId);
        if (initial.sourceAccountId === input.destinationAccountId)
          throw new BadRequestException('Distinct accounts required');
        const accounts = await tx.execute<{ id: string; openingDate: string }>(
          sql`SELECT id, opening_date::text AS "openingDate" FROM finance.accounts WHERE household_id = ${householdId} AND id IN (${initial.sourceAccountId}::uuid,${input.destinationAccountId}::uuid) ORDER BY id FOR UPDATE`,
        );
        if (accounts.rows.length !== 2)
          throw new NotFoundException('Financial resource not found');
        await tx.execute(
          sql`SELECT id FROM finance.events WHERE household_id = ${householdId} AND id = ${eventId} FOR UPDATE`,
        );
        const current = await this.view(tx, householdId, eventId);
        if (
          current.version !== input.expectedVersion ||
          current.type !== 'UNCLASSIFIED_OUTFLOW'
        )
          throw new ConflictException('Financial event version changed');
        if (input.destinationEffectiveDate < current.sourceEffectiveDate)
          throw new BadRequestException('Arrival precedes outflow');
        const destinationId = randomUUID();
        const sourceState =
          current.sourceEffectiveDate <
          accounts.rows.find((a) => a.id === current.sourceAccountId)!
            .openingDate
            ? 'PENDING_PRE_OPENING'
            : 'APPLIED';
        const destinationState =
          input.destinationEffectiveDate <
          accounts.rows.find((a) => a.id === input.destinationAccountId)!
            .openingDate
            ? 'PENDING_PRE_OPENING'
            : 'APPLIED';
        await tx.execute(
          sql`INSERT INTO finance.event_versions(household_id,event_id,version,movement_id,account_id,amount_cents,currency,effective_date,description,state,date_provenance,recorded_by_user_id,recorded_at,event_type,destination_movement_id,destination_account_id,destination_effective_date) SELECT household_id,event_id,2,movement_id,account_id,amount_cents,currency,effective_date,description,'APPLIED',date_provenance,recorded_by_user_id,recorded_at,'INTERNAL_TRANSFER',${destinationId},${input.destinationAccountId},${input.destinationEffectiveDate}::date FROM finance.event_versions WHERE household_id = ${householdId} AND event_id = ${eventId} AND version = 1`,
        );
        await tx.execute(
          sql`INSERT INTO finance.movements(id,household_id,event_id,version,account_id,amount_cents,effective_date,state,sequence,event_type,side) SELECT id,household_id,event_id,2,account_id,amount_cents,effective_date,${sourceState},sequence,'INTERNAL_TRANSFER','TRANSFER_OUT' FROM finance.movements WHERE household_id = ${householdId} AND event_id = ${eventId} AND version = 1`,
        );
        await tx.execute(
          sql`INSERT INTO finance.movements(id,household_id,event_id,version,account_id,amount_cents,effective_date,state,event_type,side) VALUES (${destinationId},${householdId},${eventId},2,${input.destinationAccountId},${current.amountCents}::bigint,${input.destinationEffectiveDate}::date,${destinationState},'INTERNAL_TRANSFER','TRANSFER_IN')`,
        );
        await tx.execute(
          sql`INSERT INTO finance.arrival_links(household_id,event_id,version,actor_user_id,reason) VALUES (${householdId},${eventId},2,${userId},${input.reason})`,
        );
        await tx.execute(
          sql`UPDATE finance.events SET current_version = 2,type = 'INTERNAL_TRANSFER' WHERE household_id = ${householdId} AND id = ${eventId}`,
        );
        return this.view(tx, householdId, eventId);
      },
    );
  }
  private command(
    userId: string,
    householdId: string,
    key: string,
    operation: string,
    input: object,
    work: (tx: Tx) => Promise<OutflowView>,
  ) {
    return this.authorized(userId, householdId, true, async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${householdId}:${operation}:${key}`},0))`,
      );
      const prior = await tx.execute<{
        actor: string;
        same: boolean;
        eventId: string;
        response: OutflowView;
      }>(
        sql`SELECT actor_user_id AS actor, request_payload = ${JSON.stringify(input)}::jsonb AS same,
          event_id AS "eventId", response FROM finance.outflow_requests
          WHERE household_id = ${householdId} AND operation = ${operation} AND request_key = ${key}`,
      );
      if (prior.rows[0]) {
        if (prior.rows[0].actor !== userId || !prior.rows[0].same)
          throw new ConflictException('Idempotency key already used');
        const response = prior.rows[0].response;
        const accessible = await tx.execute<{ valid: boolean }>(sql`
          SELECT EXISTS (
            SELECT 1 FROM finance.events e
            JOIN finance.accounts src ON (src.household_id, src.id)
              = (e.household_id, ${response.sourceAccountId}::uuid)
            LEFT JOIN finance.accounts dst ON (dst.household_id, dst.id)
              = (e.household_id, ${response.destinationAccountId}::uuid)
            WHERE e.household_id = ${householdId} AND e.id = ${prior.rows[0].eventId}
              AND (${response.destinationAccountId}::uuid IS NULL OR dst.id IS NOT NULL)
          ) AS valid`);
        if (!accessible.rows[0].valid)
          throw new NotFoundException('Financial resource not found');
        return response;
      }
      const response = await work(tx);
      await tx.execute(
        sql`INSERT INTO finance.outflow_requests(household_id,operation,request_key,actor_user_id,request_payload,event_id,version,event_type,response) VALUES (${householdId},${operation},${key},${userId},${JSON.stringify(input)}::jsonb,${response.eventId},${response.version},${response.type},${JSON.stringify(response)}::jsonb)`,
      );
      return response;
    });
  }
  list(
    userId: string,
    householdId: string,
    date: string,
    limit: number,
    cursor?: string,
  ) {
    return this.authorized(
      userId,
      householdId,
      false,
      async (tx) => {
        const rows = await tx.execute<{ id: string }>(
          sql`SELECT e.id FROM finance.events e JOIN finance.event_versions v ON (v.household_id,v.event_id,v.version) = (e.household_id,e.id,e.current_version) WHERE e.household_id = ${householdId} AND e.type = 'UNCLASSIFIED_OUTFLOW' AND v.effective_date <= ${date}::date ${cursor ? sql`AND e.id > ${cursor}::uuid` : sql``} ORDER BY e.id LIMIT ${limit + 1}`,
        );
        const total = await tx.execute<{ total: string }>(
          sql`SELECT COALESCE(sum(v.amount_cents::numeric),0)::text AS total FROM finance.events e JOIN finance.event_versions v ON (v.household_id,v.event_id,v.version) = (e.household_id,e.id,e.current_version) WHERE e.household_id = ${householdId} AND e.type = 'UNCLASSIFIED_OUTFLOW' AND v.effective_date <= ${date}::date`,
        );
        const items: OutflowView[] = [];
        for (const row of rows.rows.slice(0, limit))
          items.push(await this.view(tx, householdId, row.id));
        return {
          date,
          currency: 'BRL',
          reviewOutflowCents: total.rows[0].total,
          hasUnclassifiedOutflow: total.rows[0].total !== '0',
          items,
          nextCursor: rows.rows.length > limit ? items.at(-1)!.eventId : null,
        };
      },
      true,
    );
  }
}
