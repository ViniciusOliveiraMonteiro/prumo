import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { HouseholdController } from './household.controller.js';
import { HouseholdService } from './household.service.js';
import {
  AuthInvitationController,
  HouseholdInvitationController,
} from './invitation.controller.js';
import { InvitationService } from './invitation.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [
    HouseholdController,
    HouseholdInvitationController,
    AuthInvitationController,
  ],
  providers: [HouseholdService, InvitationService],
})
export class HouseholdModule {}
