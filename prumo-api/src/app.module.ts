import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { HouseholdModule } from './household/household.module.js';
import { FinanceModule } from './finance/finance.module.js';

@Module({
  imports: [HealthModule, IdentityModule, HouseholdModule, FinanceModule],
})
export class AppModule {}
