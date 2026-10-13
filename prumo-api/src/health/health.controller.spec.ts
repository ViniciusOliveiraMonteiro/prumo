import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HEALTH_CHECK, type HealthCheck } from './health.port.js';

describe('HealthController', () => {
  it('uses the bound health check', async () => {
    const healthCheck: HealthCheck = { check: () => ({ status: 'ok' }) };
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HEALTH_CHECK, useValue: healthCheck }],
    }).compile();

    expect(module.get(HealthController).getHealth()).toEqual({ status: 'ok' });
  });
});
