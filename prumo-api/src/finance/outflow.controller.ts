import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import {
  ApiProperty,
  ApiTags,
  ApiCookieAuth,
  ApiHeader,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import {
  OutflowService,
  type OutflowInput,
  type ArrivalInput,
} from './outflow.service.js';
class OutflowBody {
  @ApiProperty({ format: 'uuid' }) sourceAccountId!: string;
  @ApiProperty({
    pattern: '^[1-9][0-9]*$',
    description: 'Positive BRL cents, at most 9007199254740991.',
  })
  amountCents!: string;
  @ApiProperty({ enum: ['BRL'] }) currency!: 'BRL';
  @ApiProperty({ format: 'date' }) sourceEffectiveDate!: string;
  @ApiProperty({ minLength: 1, maxLength: 240 }) description!: string;
}
class ArrivalBody {
  @ApiProperty({ enum: [1] }) expectedVersion!: number;
  @ApiProperty({ format: 'uuid' }) destinationAccountId!: string;
  @ApiProperty({ format: 'date' }) destinationEffectiveDate!: string;
  @ApiProperty({ minLength: 1, maxLength: 240 }) reason!: string;
}
class ResolutionResponse {
  @ApiProperty({ format: 'uuid' }) actorUserId!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({ enum: [1] }) previousVersion!: number;
}
class OutflowResponse extends OutflowBody {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ enum: [1, 2] }) version!: number;
  @ApiProperty({ enum: ['UNCLASSIFIED_OUTFLOW', 'INTERNAL_TRANSFER'] })
  type!: string;
  @ApiProperty({ format: 'uuid' }) sourceMovementId!: string;
  @ApiProperty() sourceMovementAmountCents!: string;
  @ApiProperty({ enum: ['APPLIED', 'PENDING_PRE_OPENING'] })
  sourceState!: string;
  @ApiProperty({ enum: ['MANUAL_USER'] }) sourceDateProvenance!: string;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({ format: 'uuid' }) recordedByUserId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  destinationAccountId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  destinationMovementId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date' })
  destinationEffectiveDate!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    enum: ['APPLIED', 'PENDING_PRE_OPENING'],
  })
  destinationState!: string | null;
  @ApiProperty({ type: String, nullable: true })
  destinationMovementAmountCents!: string | null;
  @ApiProperty({ type: ResolutionResponse, nullable: true })
  resolution!: ResolutionResponse | null;
}
class OutflowPage {
  @ApiProperty({ format: 'date' }) date!: string;
  @ApiProperty({ enum: ['BRL'] }) currency!: string;
  @ApiProperty({
    description:
      'Exact aggregate of economically unclassified debits, separate from confirmed transit.',
  })
  reviewOutflowCents!: string;
  @ApiProperty() hasUnclassifiedOutflow!: boolean;
  @ApiProperty({ type: [OutflowResponse] }) items!: OutflowResponse[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value))
    throw new BadRequestException('Invalid resource id or Idempotency-Key');
  return value.toLowerCase();
}
function date(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000-') ||
    !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) ||
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Invalid date');
  return value;
}
function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (part: string) =>
    parts.find((item) => item.type === part)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function text(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > 240 ||
    value.includes('\0')
  )
    throw new BadRequestException('Invalid description or reason');
  return value.trim();
}
@Controller('households/:householdId/transactions/unclassified-outflows')
@ApiTags('unclassified-outflows')
@ApiCookieAuth('__Host-sid')
export class OutflowController {
  constructor(private readonly outflows: OutflowService) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: OutflowResponse })
  create(
    @CurrentUser() user: { id: string },
    @Param('householdId') house: string,
    @Headers('idempotency-key') key: string,
    @Body() body: OutflowBody,
  ) {
    if (
      !body ||
      body.currency !== 'BRL' ||
      typeof body.amountCents !== 'string' ||
      !/^[1-9]\d{0,15}$/.test(body.amountCents) ||
      BigInt(body.amountCents) > 9007199254740991n
    )
      throw new BadRequestException('Invalid outflow');
    const day = date(body.sourceEffectiveDate);
    if (day > todayInSaoPaulo())
      throw new BadRequestException('Future outflow');
    const input: OutflowInput = {
      sourceAccountId: id(body.sourceAccountId),
      amountCents: body.amountCents,
      currency: 'BRL',
      sourceEffectiveDate: day,
      description: text(body.description),
    };
    return this.outflows.create(user.id, id(house), id(key), input);
  }
  @Post(':eventId/arrival-links')
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: OutflowResponse })
  link(
    @CurrentUser() user: { id: string },
    @Param('householdId') house: string,
    @Param('eventId') event: string,
    @Headers('idempotency-key') key: string,
    @Body() body: ArrivalBody,
  ) {
    if (
      !body ||
      body.expectedVersion !== 1 ||
      Object.keys(body).some(
        (k) =>
          ![
            'expectedVersion',
            'destinationAccountId',
            'destinationEffectiveDate',
            'reason',
          ].includes(k),
      )
    )
      throw new BadRequestException('Invalid arrival link');
    const day = date(body.destinationEffectiveDate);
    if (day > todayInSaoPaulo())
      throw new BadRequestException('Future arrival');
    const input: ArrivalInput = {
      expectedVersion: body.expectedVersion,
      destinationAccountId: id(body.destinationAccountId),
      destinationEffectiveDate: day,
      reason: text(body.reason),
    };
    return this.outflows.link(user.id, id(house), id(event), id(key), input);
  }
  @Get(':eventId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: OutflowResponse })
  get(
    @CurrentUser() user: { id: string },
    @Param('householdId') house: string,
    @Param('eventId') event: string,
  ) {
    return this.outflows.get(user.id, id(house), id(event));
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'date', required: true, type: String, format: 'date' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiOkResponse({ type: OutflowPage })
  list(
    @CurrentUser() user: { id: string },
    @Param('householdId') house: string,
    @Query('date') day: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    if (limit !== undefined && !/^(?:[1-9]\d?|100)$/.test(limit))
      throw new BadRequestException('Invalid limit');
    return this.outflows.list(
      user.id,
      id(house),
      date(day),
      limit ? Number(limit) : 100,
      cursor === undefined ? undefined : id(cursor),
    );
  }
}
