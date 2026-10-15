import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';

@Module({
  imports: [HealthModule, IdentityModule],
})
export class AppModule {}
