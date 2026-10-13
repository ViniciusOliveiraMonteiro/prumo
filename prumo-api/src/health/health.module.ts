import { Module } from '@nestjs/common';
import { HEALTH_CHECK } from './health.port.js';
import { HealthController } from './health.controller.js';
import { ProcessHealthCheck } from './process-health-check.service.js';

@Module({
  controllers: [HealthController],
  providers: [{ provide: HEALTH_CHECK, useClass: ProcessHealthCheck }],
})
export class HealthModule {}
