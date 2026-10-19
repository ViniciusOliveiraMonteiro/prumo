import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CurrentUser,
  PasswordHasher,
  Public,
  SignInService,
} from '@nestjs/authentication';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ChangePasswordService } from './change-password.service.js';
import { IdentityUserRepository } from './identity-user.repository.js';
import { SignInAttemptsService } from './sign-in-attempts.service.js';
import { normalizeEmail } from './normalize-email.js';
import { RecoveryCodesService } from './recovery-codes.service.js';
import type { Response } from 'express';

class SignInBody {
  @ApiProperty({ example: 'person@example.com' })
  email!: string;

  @ApiProperty({ format: 'password' })
  password!: string;
}

class ChangePasswordBody {
  @ApiProperty({ format: 'password' })
  currentPassword!: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 1024 })
  newPassword!: string;
}

class IssueRecoveryCodesBody {
  @ApiProperty({ format: 'password' })
  currentPassword!: string;
}

class RecoveryCodesResponse {
  @ApiProperty({ type: [String] })
  codes!: string[];
}

class RecoverWithCodeBody {
  @ApiProperty({ example: 'person@example.com' })
  email!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 1024 })
  newPassword!: string;
}

class CurrentUserResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;
}

@Controller('auth')
@ApiTags('identity')
export class IdentityController {
  constructor(
    private readonly users: IdentityUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly signInService: SignInService,
    private readonly attempts: SignInAttemptsService,
    private readonly passwordChanges: ChangePasswordService,
    private readonly recoveryCodes: RecoveryCodesService,
  ) {}

  @Public()
  @Post('sign-in')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOkResponse({ type: CurrentUserResponse })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiTooManyRequestsResponse({
    description: 'Tentativas excessivas; consulte Retry-After.',
  })
  async signIn(
    @Body() body: SignInBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponse> {
    const email = normalizeEmail(body?.email);
    if (
      !body ||
      !email ||
      typeof body.password !== 'string' ||
      body.password.length > 4096
    ) {
      throw new BadRequestException('Invalid credentials');
    }
    const retryAfter = await this.attempts.retryAfter(email);
    if (retryAfter !== null) {
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        'Too many attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const found = await this.users.findCredentials(email);
    if (!(await this.hasher.verify(body.password, found?.passwordHash))) {
      const failedRetryAfter = await this.attempts.recordFailure(email);
      if (failedRetryAfter !== null) {
        response.setHeader('Retry-After', String(failedRetryAfter));
        throw new HttpException(
          'Too many attempts',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!found) throw new UnauthorizedException('Invalid credentials');
    await this.attempts.clear(email);
    await this.signInService.signIn(found.user.id, {
      metadata: { credentialVersion: found.credentialVersion },
    });
    return found.user;
  }

  @Get('me')
  @ApiCookieAuth('__Host-sid')
  @ApiOkResponse({ type: CurrentUserResponse })
  @ApiUnauthorizedResponse()
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: CurrentUserResponse): CurrentUserResponse {
    return { id: user.id, email: user.email };
  }

  @Post('sign-out')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  @ApiCookieAuth('__Host-sid')
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  async signOut(): Promise<void> {
    await this.signInService.signOut();
  }

  @Post('sign-out-all')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  @ApiCookieAuth('__Host-sid')
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  async signOutAll(@CurrentUser('id') userId: string): Promise<void> {
    await this.signInService.signOutEverywhere(userId);
  }

  @Post('change-password')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  @ApiCookieAuth('__Host-sid')
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: ChangePasswordBody,
  ): Promise<void> {
    if (
      !body ||
      typeof body.currentPassword !== 'string' ||
      body.currentPassword.length === 0 ||
      body.currentPassword.length > 4096 ||
      typeof body.newPassword !== 'string' ||
      body.newPassword.length < 12 ||
      body.newPassword.length > 1024
    ) {
      throw new BadRequestException('Invalid password');
    }
    await this.passwordChanges.change(
      userId,
      body.currentPassword,
      body.newPassword,
    );
    await this.signInService.signOut();
  }

  @Post('recovery-codes')
  @Header('Cache-Control', 'no-store')
  @ApiCookieAuth('__Host-sid')
  @ApiOkResponse({ type: RecoveryCodesResponse })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async issueRecoveryCodes(
    @CurrentUser('id') userId: string,
    @Body() body: IssueRecoveryCodesBody,
  ): Promise<RecoveryCodesResponse> {
    if (
      typeof body?.currentPassword !== 'string' ||
      body.currentPassword.length === 0 ||
      body.currentPassword.length > 4096
    ) {
      throw new BadRequestException('Invalid password');
    }
    return {
      codes: await this.recoveryCodes.issue(userId, body.currentPassword),
    };
  }

  @Public()
  @Post('recover-with-code')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOkResponse({ type: RecoveryCodesResponse })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiTooManyRequestsResponse()
  async recoverWithCode(
    @Body() body: RecoverWithCodeBody,
  ): Promise<RecoveryCodesResponse> {
    const email = normalizeEmail(body?.email);
    if (
      !email ||
      typeof body.code !== 'string' ||
      !/^[A-Za-z0-9_-]{22}$/.test(body.code) ||
      typeof body.newPassword !== 'string' ||
      body.newPassword.length < 12 ||
      body.newPassword.length > 1024
    ) {
      throw new BadRequestException('Invalid recovery request');
    }
    return {
      codes: await this.recoveryCodes.recover(
        email,
        body.code,
        body.newPassword,
      ),
    };
  }
}
