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
  IncomeService,
  type IncomeInput,
  type IncomeView,
  type BalanceView,
  type MovementPage,
} from './income.service.js';

class IncomeBody {
  @ApiProperty({ format: 'uuid' }) accountId!: string;
  @ApiProperty({
    pattern: '^[1-9][0-9]*$',
    example: '20000',
    description: 'Positive integer cents, at most 9007199254740991.',
  })
  amountCents!: string;
  @ApiProperty({ enum: ['BRL'] }) currency!: 'BRL';
  @ApiProperty({ format: 'date' }) effectiveDate!: string;
  @ApiProperty({ minLength: 1, maxLength: 240 }) description!: string;
}
class IncomeResponse extends IncomeBody {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'uuid' }) movementId!: string;
  @ApiProperty({ enum: [1, 2] }) version!: number;
  @ApiProperty({
    enum: [
      'RECEIVED_INCOME',
      'DIRECT_EXPENSE',
      'INTERNAL_TRANSFER',
      'UNCLASSIFIED_OUTFLOW',
    ],
  })
  type!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  categoryId!: string | null;
  @ApiProperty({
    type: String,
    description: 'Signed account movement in cents.',
  })
  movementAmountCents!: string;
  @ApiProperty({ enum: ['APPLIED', 'PENDING_PRE_OPENING'] }) state!: string;
  @ApiProperty({ type: String, enum: ['PRE_OPENING'], nullable: true })
  pendingReason!: string | null;
  @ApiProperty({ enum: ['MANUAL_USER'] }) dateProvenance!: string;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({
    description: 'Persistent registration order, not real-world chronology.',
    pattern: '^[1-9][0-9]*$',
  })
  sequence!: string;
}
class BalanceResponse {
  @ApiProperty({ enum: ['BRL'] }) currency!: string;
  @ApiProperty({ format: 'date' }) date!: string;
  @ApiProperty({ format: 'date' }) openingDate!: string;
  @ApiProperty({ type: String }) openingBalanceCents!: string;
  @ApiProperty() calculable!: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact signed integer cents. Aggregate has no individual-entry limit.',
  })
  balanceCents!: string | null;
  @ApiProperty({
    type: Boolean,
    nullable: true,
    description:
      'True when the calculated balance is negative on the requested date; null before the opening date. It is an alert for review, not available bank credit.',
  })
  negativeBalance!: boolean | null;
}
class MovementPageResponse {
  @ApiProperty({ type: [IncomeResponse] }) items!: IncomeResponse[];
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Cursor by effective day and registration sequence. Restart pagination after retroactive insertions for a complete view.',
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
function input(body: IncomeBody): IncomeInput {
  if (
    !body ||
    body.currency !== 'BRL' ||
    typeof body.amountCents !== 'string' ||
    body.amountCents.length > 16 ||
    !/^[1-9]\d*$/.test(body.amountCents) ||
    BigInt(body.amountCents) > 9007199254740991n ||
    typeof body.description !== 'string'
  )
    throw new BadRequestException('Invalid income');
  const description = body.description.trim();
  if (!description || description.length > 240 || description.includes('\0'))
    throw new BadRequestException('Invalid description');
  return {
    accountId: id(body.accountId),
    amountCents: body.amountCents,
    currency: 'BRL',
    effectiveDate: date(body.effectiveDate),
    description,
  };
}
@Controller('households/:householdId')
@ApiTags('income')
@ApiCookieAuth('__Host-sid')
@ApiUnauthorizedResponse()
@ApiBadRequestResponse()
@ApiNotFoundResponse()
export class IncomeController {
  constructor(private readonly incomes: IncomeService) {}
  @Header('Cache-Control', 'no-store')
  @Post('transactions/income')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID identifying the income creation request.',
  })
  @ApiCreatedResponse({ type: IncomeResponse })
  @ApiConflictResponse()
  @ApiForbiddenResponse()
  create(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: IncomeBody,
  ): Promise<IncomeView> {
    return this.incomes.create(user.id, id(householdId), id(key), input(body));
  }
  @Header('Cache-Control', 'no-store')
  @Get('transactions/:eventId')
  @ApiOkResponse({ type: IncomeResponse })
  get(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Param('eventId') eventId: string,
  ): Promise<IncomeView> {
    return this.incomes.get(user.id, id(householdId), id(eventId));
  }
  @Header('Cache-Control', 'no-store')
  @Get('accounts/:accountId/balance')
  @ApiQuery({ name: 'date', required: true, type: String, format: 'date' })
  @ApiOkResponse({ type: BalanceResponse })
  balance(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Param('accountId') accountId: string,
    @Query('date') day: string,
  ): Promise<BalanceView> {
    return this.incomes.balance(
      user.id,
      id(householdId),
      id(accountId),
      date(day),
    );
  }
  @Header('Cache-Control', 'no-store')
  @Get('accounts/:accountId/movements')
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiOkResponse({ type: MovementPageResponse })
  movements(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Param('accountId') accountId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<MovementPage> {
    if (
      limit !== undefined &&
      (typeof limit !== 'string' || !/^(?:[1-9]\d?|100)$/.test(limit))
    )
      throw new BadRequestException('Invalid limit');
    let after: { date: string; sequence: string } | undefined;
    if (cursor !== undefined) {
      if (
        typeof cursor !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}:[1-9]\d{0,18}$/.test(cursor)
      )
        throw new BadRequestException('Invalid cursor');
      const [day, sequence] = cursor.split(':');
      if (BigInt(sequence) > 9223372036854775807n)
        throw new BadRequestException('Invalid cursor');
      after = { date: date(day), sequence };
    }
    return this.incomes.movements(
      user.id,
      id(householdId),
      id(accountId),
      limit ? Number(limit) : 100,
      after,
    );
  }
}
