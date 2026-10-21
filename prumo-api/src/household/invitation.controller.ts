import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  InvitationService,
  type InvitationView,
} from './invitation.service.js';

class InvitationBody {
  @ApiProperty({ format: 'uuid' })
  inviteeUserId!: string;
}

class InvitationRequestResponse {
  @ApiProperty({
    format: 'uuid',
    description: 'Opaque request identifier; delivery is not confirmed.',
  })
  requestId!: string;
}

class InvitationResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) householdId!: string;
  @ApiProperty() householdName!: string;
  @ApiProperty({ enum: ['VIEWER'] }) role!: 'VIEWER';
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

function uuid(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new BadRequestException('Invalid resource id');
  return value.toLowerCase();
}

@Controller('households/:id/invitations')
@ApiTags('households')
@ApiCookieAuth('__Host-sid')
@ApiUnauthorizedResponse()
export class HouseholdInvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Post()
  @HttpCode(202)
  @ApiAcceptedResponse({ type: InvitationRequestResponse })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiTooManyRequestsResponse()
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentUser('id') userId: string,
    @Param('id') householdId: string,
    @Body() body: InvitationBody,
  ): Promise<{ requestId: string }> {
    return this.invitations.create(
      userId,
      uuid(householdId),
      uuid(body?.inviteeUserId),
    );
  }

  @Post(':requestId/cancel')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  cancel(
    @CurrentUser('id') userId: string,
    @Param('id') householdId: string,
    @Param('requestId') requestId: string,
  ): Promise<void> {
    return this.invitations.cancel(userId, uuid(householdId), uuid(requestId));
  }
}

@Controller('auth/invitations')
@ApiTags('identity')
@ApiCookieAuth('__Host-sid')
@ApiUnauthorizedResponse()
export class AuthInvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Get()
  @ApiOkResponse({ type: [InvitationResponse] })
  @Header('Cache-Control', 'no-store')
  inbox(@CurrentUser('id') userId: string): Promise<InvitationView[]> {
    return this.invitations.inbox(userId);
  }

  @Post(':invitationId/accept')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiNotFoundResponse()
  @Header('Cache-Control', 'no-store')
  accept(
    @CurrentUser('id') userId: string,
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    return this.invitations.accept(userId, uuid(invitationId));
  }
}
