import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { ChangePasswordService } from './change-password.service.js';
import { DrizzleSessionStore } from './drizzle-session.store.js';
import { IdentityController } from './identity.controller.js';
import { IdentityDatabase } from './identity.database.js';
import { IdentitySessionProvider } from './identity-session.provider.js';
import { IdentityUserRepository } from './identity-user.repository.js';
import { SignInAttemptsService } from './sign-in-attempts.service.js';
import { RecoveryCodesService } from './recovery-codes.service.js';
import { publicOrigin } from '../http/public-origin.js';

@Module({
  imports: [
    AuthenticationModule.forRootAsync({
      useFactory: () => ({ session: { trustedOrigins: [publicOrigin()] } }),
    }),
  ],
  controllers: [IdentityController],
  providers: [
    IdentityDatabase,
    IdentityUserRepository,
    SignInAttemptsService,
    ChangePasswordService,
    RecoveryCodesService,
    DrizzleSessionStore,
    IdentitySessionProvider,
  ],
})
export class IdentityModule {}
