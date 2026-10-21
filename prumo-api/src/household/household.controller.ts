import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  HouseholdService,
  type HouseholdView,
  type MembershipView,
} from './household.service.js';

class HouseholdNameBody {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  name!: string;
}

class HouseholdResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['OWNER', 'MEMBER', 'VIEWER'] })
  role!: 'OWNER' | 'MEMBER' | 'VIEWER';
}

class MembershipResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['OWNER', 'MEMBER', 'VIEWER'] })
  role!: 'OWNER' | 'MEMBER' | 'VIEWER';
}

function nameOf(body: HouseholdNameBody): string {
  if (!body || typeof body.name !== 'string')
    throw new BadRequestException('Invalid name');
  const name = body.name.trim();
  if (name.length < 1 || name.length > 120 || name.includes('\0'))
    throw new BadRequestException('Invalid name');
  return name;
}

function resourceIdOf(id: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new BadRequestException('Invalid resource id');
  return id.toLowerCase();
}

@Controller('households')
@ApiTags('households')
@ApiCookieAuth('__Host-sid')
@ApiUnauthorizedResponse()
export class HouseholdController {
  constructor(private readonly households: HouseholdService) {}

  @Post()
  @ApiCreatedResponse({ type: HouseholdResponse })
  @ApiBadRequestResponse()
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentUser() user: { id: string },
    @Body() body: HouseholdNameBody,
  ): Promise<HouseholdView> {
    return this.households.create(user.id, nameOf(body));
  }

  @Get()
  @ApiOkResponse({ type: [HouseholdResponse] })
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: { id: string }): Promise<HouseholdView[]> {
    return this.households.list(user.id);
  }

  @Get(':id')
  @ApiOkResponse({ type: HouseholdResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<HouseholdView> {
    return this.households.get(user.id, resourceIdOf(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: HouseholdResponse })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  rename(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: HouseholdNameBody,
  ): Promise<HouseholdView> {
    return this.households.rename(user.id, resourceIdOf(id), nameOf(body));
  }

  @Get(':id/memberships')
  @ApiOkResponse({ type: [MembershipResponse] })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  listMemberships(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<MembershipView[]> {
    return this.households.listMemberships(user.id, resourceIdOf(id));
  }

  @Post(':id/memberships/:userId/revoke')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Revoked or already inactive.' })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Owner membership cannot be revoked.' })
  @Header('Cache-Control', 'no-store')
  revokeMembership(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    return this.households.revokeMembership(
      user.id,
      resourceIdOf(id),
      resourceIdOf(targetUserId),
    );
  }
}
