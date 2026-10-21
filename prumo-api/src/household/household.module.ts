import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { HouseholdController } from './household.controller.js';
import { HouseholdService } from './household.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [HouseholdController],
  providers: [HouseholdService],
})
export class HouseholdModule {}
