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
  ExpenseService,
  type CategoryView,
  type ExpenseView,
  type ExpenseInput,
} from './expense.service.js';

class CategoryBody {
  @ApiProperty({ minLength: 1, maxLength: 80 }) name!: string;
}
class CategoryResponse extends CategoryBody {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) householdId!: string;
  @ApiProperty({ format: 'uuid' }) createdByUserId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
class ExpenseBody {
  @ApiProperty({ format: 'uuid' }) accountId!: string;
  @ApiProperty({ format: 'uuid' }) categoryId!: string;
  @ApiProperty({
    pattern: '^[1-9][0-9]*$',
    example: '13000',
    description: 'Positive integer cents, at most 9007199254740991.',
  })
  amountCents!: string;
  @ApiProperty({ enum: ['BRL'] }) currency!: 'BRL';
  @ApiProperty({ format: 'date' }) effectiveDate!: string;
  @ApiProperty({ minLength: 1, maxLength: 240 }) description!: string;
}
class ExpenseResponse extends ExpenseBody {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'uuid' }) movementId!: string;
  @ApiProperty({ enum: [1] }) version!: number;
  @ApiProperty({ enum: ['DIRECT_EXPENSE'] }) type!: string;
  @ApiProperty({
    type: String,
    description: 'Negative account movement in cents.',
  })
  movementAmountCents!: string;
  @ApiProperty({ enum: ['APPLIED', 'PENDING_PRE_OPENING'] }) state!: string;
  @ApiProperty({ type: String, enum: ['PRE_OPENING'], nullable: true })
  pendingReason!: string | null;
  @ApiProperty({ enum: ['MANUAL_USER'] }) dateProvenance!: string;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({
    type: String,
    description: 'Persistent registration order, not real-world chronology.',
  })
  sequence!: string;
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
function expenseInput(body: ExpenseBody): ExpenseInput {
  if (
    !body ||
    body.currency !== 'BRL' ||
    typeof body.amountCents !== 'string' ||
    body.amountCents.length > 16 ||
    !/^[1-9]\d*$/.test(body.amountCents) ||
    BigInt(body.amountCents) > 9007199254740991n ||
    typeof body.description !== 'string'
  )
    throw new BadRequestException('Invalid expense');
  const description = body.description.trim();
  if (!description || description.length > 240 || description.includes('\0'))
    throw new BadRequestException('Invalid description');
  return {
    accountId: id(body.accountId),
    categoryId: id(body.categoryId),
    amountCents: body.amountCents,
    currency: 'BRL',
    effectiveDate: date(body.effectiveDate),
    description,
  };
}

@Controller('households/:householdId')
@ApiTags('expenses')
@ApiCookieAuth('__Host-sid')
@ApiUnauthorizedResponse()
@ApiBadRequestResponse()
@ApiNotFoundResponse()
export class ExpenseController {
  constructor(private readonly expenses: ExpenseService) {}

  @Header('Cache-Control', 'no-store')
  @Post('expense-categories')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID identifying the category creation request.',
  })
  @ApiCreatedResponse({ type: CategoryResponse })
  @ApiConflictResponse()
  @ApiForbiddenResponse()
  createCategory(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CategoryBody,
  ): Promise<CategoryView> {
    if (!body || typeof body.name !== 'string')
      throw new BadRequestException('Invalid category');
    const name = body.name.trim();
    if (!name || name.length > 80 || name.includes('\0'))
      throw new BadRequestException('Invalid category');
    return this.expenses.createCategory(user.id, id(householdId), id(key), {
      name,
    });
  }

  @Header('Cache-Control', 'no-store')
  @Get('expense-categories')
  @ApiOkResponse({ type: [CategoryResponse] })
  listCategories(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
  ): Promise<CategoryView[]> {
    return this.expenses.listCategories(user.id, id(householdId));
  }

  @Header('Cache-Control', 'no-store')
  @Post('transactions/expenses')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID identifying the expense creation request.',
  })
  @ApiCreatedResponse({ type: ExpenseResponse })
  @ApiConflictResponse()
  @ApiForbiddenResponse()
  createExpense(
    @CurrentUser() user: { id: string },
    @Param('householdId') householdId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: ExpenseBody,
  ): Promise<ExpenseView> {
    return this.expenses.createExpense(
      user.id,
      id(householdId),
      id(key),
      expenseInput(body),
    );
  }
}
