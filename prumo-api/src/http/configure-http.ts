import type { INestApplication } from '@nestjs/common';

export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableCsrfProtection({ trustedOrigins: [] });
}
