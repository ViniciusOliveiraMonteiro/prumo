import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AccountService,
  type AccountInput,
  type AccountView,
} from './account.service.js';

class AccountBody {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  name!: string;

  @ApiProperty({ enum: ['BRL'] })
  currency!: 'BRL';

  @ApiProperty({ example: '2026-11-03', format: 'date' })
  openingDate!: string;

  @ApiProperty({
    example: '-12345',
    description: 'Signed integer cents as a decimal string.',
  })
  openingBalanceCents!: string;
}

class AccountResponse extends AccountBody {
  @ApiProperty({ format: 'uuid' })
  id!: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxCents = 9007199254740991n;

function resourceId(value: string): string {
  if (!uuid.test(value)) throw new BadRequestException('Invalid resource id');
  return value.toLowerCase();
}

function requestKey(value: string | undefined): string {
  if (!value || !uuid.test(value))
    throw new BadRequestException('Invalid Idempotency-Key');
  return value.toLowerCase();
}

function accountInput(body: AccountBody): AccountInput {
  if (!body || typeof body.name !== 'string')
    throw new BadRequestException('Invalid account name');
  const name = body.name.trim();
  if (name.length < 1 || name.length > 120 || name.includes('\0'))
    throw new BadRequestException('Invalid account name');
  if (body.currency !== 'BRL')
    throw new BadRequestException('Invalid currency');
  if (
    typeof body.openingDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.openingDate) ||
    body.openingDate.startsWith('0000-') ||
    !Number.isFinite(Date.parse(`${body.openingDate}T00:00:00.000Z`)) ||
    new Date(`${body.openingDate}T00:00:00.000Z`).toISOString().slice(0, 10) !==
      body.openingDate
  )
    throw new BadRequestException('Invalid opening date');
  if (
    typeof body.openingBalanceCents !== 'string' ||
    body.openingBalanceCents.length > 17 ||
    !/^(0|-?[1-9]\d*)$/.test(body.openingBalanceCents)
  )
    throw new BadRequestException('Invalid opening balance');
  const cents = BigInt(body.openingBalanceCents);
  if (cents < -maxCents || cents > maxCents)
    throw new BadRequestException('Invalid opening balance');
  return {
    name,
    currency: 'BRL',
    openingDate: body.openingDate,
    openingBalanceCents: cents.toString(),
  };
}

@Controller('households/:householdId/accounts')
@ApiTags('accounts')
@ApiCookieAuth('__Host-sid')
@ApiUnauthorizedResponse()
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID identifying this creation request.',
    required: true,
  })
  @ApiCreatedResponse({ type: AccountResponse })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: AccountBody,
  ): Promise<AccountView> {
    return this.accounts.create(
      user.id,
      resourceId(householdId),
      requestKey(key),
      accountInput(body),
    );
  }

  @Get()
  @ApiOkResponse({ type: [AccountResponse] })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
  ): Promise<AccountView[]> {
    return this.accounts.list(user.id, resourceId(householdId));
  }

  @Get(':accountId')
  @ApiOkResponse({ type: AccountResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Param('accountId') accountId: string,
  ): Promise<AccountView> {
    return this.accounts.get(
      user.id,
      resourceId(householdId),
      resourceId(accountId),
    );
  }
}
