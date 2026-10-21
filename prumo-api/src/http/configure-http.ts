import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { publicOrigin } from './public-origin.js';

export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      request.path.startsWith('/api/auth') ||
      request.path === '/api/households' ||
      request.path.startsWith('/api/households/')
    ) {
      response.setHeader('Cache-Control', 'no-store');
    }
    next();
  });
  app.enableCsrfProtection({ trustedOrigins: [publicOrigin()] });
}
