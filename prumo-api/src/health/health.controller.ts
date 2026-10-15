import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@nestjs/authentication';
import {
  HEALTH_CHECK,
  type HealthCheck,
  type HealthStatus,
} from './health.port.js';
import { HealthResponseDto } from './health-response.dto.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HEALTH_CHECK) private readonly healthCheck: HealthCheck,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Verifica o processo da API' })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthStatus {
    return this.healthCheck.check();
  }
}
