import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { HouseholdModule } from './household/household.module.js';

@Module({
  imports: [HealthModule, IdentityModule, HouseholdModule],
})
export class AppModule {}
