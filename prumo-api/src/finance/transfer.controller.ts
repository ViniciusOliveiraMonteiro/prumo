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
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  TransferService,
  type InTransitView,
  type TransferInput,
  type TransferView,
} from './transfer.service.js';

class TransferBody {
  @ApiProperty({ format: 'uuid' }) sourceAccountId!: string;
  @ApiProperty({ format: 'uuid' }) destinationAccountId!: string;
  @ApiProperty({
    pattern: '^[1-9][0-9]*$',
    description: 'Positive integer cents, at most 9007199254740991.',
  })
  amountCents!: string;
  @ApiProperty({ enum: ['BRL'] }) currency!: 'BRL';
  @ApiProperty({ format: 'date' }) sourceEffectiveDate!: string;
  @ApiProperty({ format: 'date' }) destinationEffectiveDate!: string;
  @ApiProperty({ minLength: 1, maxLength: 240 }) description!: string;
}
class TransferResponse extends TransferBody {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ enum: [1, 2] }) version!: number;
  @ApiProperty({ enum: ['INTERNAL_TRANSFER'] }) type!: string;
  @ApiProperty({ format: 'uuid' }) sourceMovementId!: string;
  @ApiProperty({ format: 'uuid' }) destinationMovementId!: string;
  @ApiProperty({ description: 'Signed negative integer cents.' })
  sourceMovementAmountCents!: string;
  @ApiProperty({ description: 'Signed positive integer cents.' })
  destinationMovementAmountCents!: string;
  @ApiProperty({ enum: ['MANUAL_USER'] }) sourceDateProvenance!: string;
  @ApiProperty({ enum: ['MANUAL_USER'] }) destinationDateProvenance!: string;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({
    enum: ['APPLIED', 'PENDING_PRE_OPENING'],
    required: false,
    description:
      'Current inclusion of the source movement; old creation replays may omit it.',
  })
  sourceState?: string;
  @ApiProperty({ enum: ['APPLIED', 'PENDING_PRE_OPENING'], required: false })
  destinationState?: string;
  @ApiProperty({ format: 'date', required: false }) sourceOpeningDate?: string;
  @ApiProperty({ format: 'date', required: false })
  destinationOpeningDate?: string;
}
class InTransitItem {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ description: 'Positive integer cents.' }) amountCents!: string;
}
class InTransitResponse {
  @ApiProperty({ format: 'date' }) date!: string;
  @ApiProperty({ enum: ['BRL'] }) currency!: string;
  @ApiProperty({ description: 'Exact aggregate integer cents.' })
  totalCents!: string;
  @ApiProperty({
    description:
      'True if any confirmed transfer with source day at or before this day has a pending side. The factual transit total alone must not be used as a consolidated balance.',
  })
  hasPendingTransferSide!: boolean;
  @ApiProperty({ type: [InTransitItem] }) items!: InTransitItem[];
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor by source day and event ID.',
  })
  nextCursor!: string | null;
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
function input(body: TransferBody): TransferInput {
  if (
    !body ||
    body.currency !== 'BRL' ||
    typeof body.amountCents !== 'string' ||
    body.amountCents.length > 16 ||
    !/^[1-9]\d*$/.test(body.amountCents) ||
    BigInt(body.amountCents) > 9007199254740991n ||
    typeof body.description !== 'string'
  )
    throw new BadRequestException('Invalid transfer');
  const description = body.description.trim();
  if (!description || description.length > 240 || description.includes('\0'))
    throw new BadRequestException('Invalid description');
  const sourceAccountId = id(body.sourceAccountId);
  const destinationAccountId = id(body.destinationAccountId);
  const sourceEffectiveDate = date(body.sourceEffectiveDate);
  const destinationEffectiveDate = date(body.destinationEffectiveDate);
  if (
    sourceAccountId === destinationAccountId ||
    sourceEffectiveDate > destinationEffectiveDate ||
    destinationEffectiveDate > todayInSaoPaulo()
  )
    throw new BadRequestException('Invalid transfer accounts or dates');
  return {
    sourceAccountId,
    destinationAccountId,
    amountCents: body.amountCents,
    currency: 'BRL',
    sourceEffectiveDate,
    destinationEffectiveDate,
    description,
  };
}

@Controller('households/:householdId')
@ApiTags('transfers')
@ApiCookieAuth('__Host-sid')
@ApiUnauthorizedResponse()
@ApiBadRequestResponse()
@ApiNotFoundResponse()
export class TransferController {
  constructor(private readonly transfers: TransferService) {}

  @Header('Cache-Control', 'no-store')
  @Post('transactions/transfers')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID identifying the transfer creation request.',
  })
  @ApiCreatedResponse({ type: TransferResponse })
  @ApiConflictResponse()
  @ApiForbiddenResponse()
  create(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: TransferBody,
  ): Promise<TransferView> {
    return this.transfers.create(
      user.id,
      id(householdId),
      id(key),
      input(body),
    );
  }

  @Header('Cache-Control', 'no-store')
  @Get('transactions/transfers/:eventId')
  @ApiOkResponse({ type: TransferResponse })
  get(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Param('eventId') eventId: string,
  ): Promise<TransferView> {
    return this.transfers.get(user.id, id(householdId), id(eventId));
  }

  @Header('Cache-Control', 'no-store')
  @Get('transfers/in-transit')
  @ApiQuery({ name: 'date', required: true, type: String, format: 'date' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiOkResponse({ type: InTransitResponse })
  inTransit(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Query('date') day: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<InTransitView> {
    if (
      limit !== undefined &&
      (typeof limit !== 'string' || !/^(?:[1-9]\d?|100)$/.test(limit))
    )
      throw new BadRequestException('Invalid limit');
    let after: { date: string; eventId: string } | undefined;
    if (cursor !== undefined) {
      if (
        typeof cursor !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}:[0-9a-f-]{36}$/i.test(cursor)
      )
        throw new BadRequestException('Invalid cursor');
      const [cursorDate, eventId] = cursor.split(':');
      after = { date: date(cursorDate), eventId: id(eventId) };
    }
    return this.transfers.inTransit(
      user.id,
      id(householdId),
      date(day),
      limit ? Number(limit) : 100,
      after,
    );
  }
}
