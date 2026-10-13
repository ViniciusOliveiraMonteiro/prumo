import { Injectable } from '@nestjs/common';
import type { HealthCheck, HealthStatus } from './health.port.js';

@Injectable()
export class ProcessHealthCheck implements HealthCheck {
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
