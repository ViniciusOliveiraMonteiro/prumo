import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { DrizzleSessionStore } from './drizzle-session.store.js';
import { IdentityController } from './identity.controller.js';
import { IdentityDatabase } from './identity.database.js';
import { IdentitySessionProvider } from './identity-session.provider.js';
import { IdentityUserRepository } from './identity-user.repository.js';
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
    DrizzleSessionStore,
    IdentitySessionProvider,
  ],
})
export class IdentityModule {}
