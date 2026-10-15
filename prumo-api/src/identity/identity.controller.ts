import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CurrentUser,
  PasswordHasher,
  Public,
  SignInService,
} from '@nestjs/authentication';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IdentityUserRepository } from './identity-user.repository.js';
import { normalizeEmail } from './normalize-email.js';

class SignInBody {
  @ApiProperty({ example: 'person@example.com' })
  email!: string;

  @ApiProperty({ format: 'password' })
  password!: string;
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
  ) {}

  @Public()
  @Post('sign-in')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOkResponse({ type: CurrentUserResponse })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async signIn(@Body() body: SignInBody): Promise<CurrentUserResponse> {
    const email = normalizeEmail(body?.email);
    if (
      !body ||
      !email ||
      typeof body.password !== 'string' ||
      body.password.length > 4096
    ) {
      throw new BadRequestException('Invalid credentials');
    }
    const found = await this.users.findCredentials(email);
    if (!(await this.hasher.verify(body.password, found?.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!found) throw new UnauthorizedException('Invalid credentials');
    await this.signInService.signIn(found.user.id);
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
}
