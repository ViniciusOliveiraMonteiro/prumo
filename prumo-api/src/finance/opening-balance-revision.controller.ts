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
  OpeningBalanceRevisionService,
  type OpeningRevisionInput,
  type OpeningRevisionPage,
  type OpeningRevisionView,
} from './opening-balance-revision.service.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxCents = 9007199254740991n;
function id(value: string | undefined): string {
  if (!value || !uuid.test(value))
    throw new BadRequestException('Invalid resource id or Idempotency-Key');
  return value.toLowerCase();
}
function positiveInt(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new BadRequestException(`Invalid ${label}`);
  return value;
}
function input(body: RevisionBody): OpeningRevisionInput {
  if (!body || typeof body !== 'object')
    throw new BadRequestException('Invalid revision');
  const expectedVersion = positiveInt(body.expectedVersion, 'expectedVersion');
  if (
    typeof body.openingBalanceCents !== 'string' ||
    !/^(0|-?[1-9]\d*)$/.test(body.openingBalanceCents) ||
    body.openingBalanceCents.length > 17
  )
    throw new BadRequestException('Invalid opening balance');
  const cents = BigInt(body.openingBalanceCents);
  if (cents < -maxCents || cents > maxCents)
    throw new BadRequestException('Invalid opening balance');
  if (typeof body.reason !== 'string')
    throw new BadRequestException('Invalid reason');
  const reason = body.reason.trim();
  if (reason.length < 1 || reason.length > 500 || reason.includes('\0'))
    throw new BadRequestException('Invalid reason');
  if (body.openingDate !== undefined) {
    const value = body.openingDate;
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value.startsWith('0000-') ||
      !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) ||
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Invalid opening date');
  }
  return {
    expectedVersion,
    openingBalanceCents: cents.toString(),
    reason,
    ...(body.openingDate === undefined
      ? {}
      : { openingDate: body.openingDate }),
  };
}
function pageInt(
  value: string | undefined,
  fallback: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value))
    throw new BadRequestException('Invalid pagination');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max)
    throw new BadRequestException('Invalid pagination');
  return number;
}

class RevisionBody {
  @ApiProperty({ example: 1, minimum: 1 })
  expectedVersion!: number;

  @ApiProperty({
    example: '499000',
    description: 'Signed integer cents as a decimal string.',
  })
  openingBalanceCents!: string;

  @ApiProperty({
    format: 'date',
    required: false,
    description:
      'Opening day at its start; omitted means the current opening day.',
  })
  openingDate?: string;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  reason!: string;
}
class RevisionResponse {
  @ApiProperty({ format: 'uuid', nullable: true })
  revisionId!: string | null;
  @ApiProperty({ format: 'uuid' })
  accountId!: string;
  @ApiProperty({ example: 2 })
  version!: number;
  @ApiProperty({ format: 'date' })
  openingDate!: string;
  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    required: false,
    description:
      'Previous opening day. Historical replays created before this contract omit it.',
  })
  previousOpeningDate?: string | null;
  @ApiProperty({ nullable: true })
  previousBalanceCents!: string | null;
  @ApiProperty()
  openingBalanceCents!: string;
  @ApiProperty({ nullable: true })
  reason!: string | null;
  @ApiProperty({ format: 'uuid' })
  actorUserId!: string;
  @ApiProperty({ format: 'date-time' })
  revisedAt!: string;
}
class RevisionPageResponse {
  @ApiProperty({ type: [RevisionResponse] })
  items!: RevisionResponse[];
  @ApiProperty({ nullable: true, type: Number })
  nextCursor!: number | null;
}

@Controller(
  'households/:householdId/accounts/:accountId/opening-balance-revisions',
)
@ApiTags('accounts')
@ApiCookieAuth('__Host-sid')
@ApiUnauthorizedResponse()
export class OpeningBalanceRevisionController {
  constructor(private readonly revisions: OpeningBalanceRevisionService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID identifying this revision request.',
  })
  @ApiCreatedResponse({ type: RevisionResponse })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  revise(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Param('accountId') accountId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: RevisionBody,
  ): Promise<OpeningRevisionView> {
    return this.revisions.revise(
      user.id,
      id(householdId),
      id(accountId),
      id(key),
      input(body),
    );
  }

  @Get()
  @ApiOkResponse({ type: RevisionPageResponse })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: 'afterVersion', required: false, type: Number, minimum: 0 })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Param('accountId') accountId: string,
    @Query('limit') limit: string | undefined,
    @Query('afterVersion') afterVersion: string | undefined,
  ): Promise<OpeningRevisionPage> {
    return this.revisions.list(
      user.id,
      id(householdId),
      id(accountId),
      pageInt(limit, 100, 100),
      afterVersion === undefined
        ? 0
        : afterVersion === '0'
          ? 0
          : pageInt(afterVersion, 0, Number.MAX_SAFE_INTEGER),
    );
  }
}
