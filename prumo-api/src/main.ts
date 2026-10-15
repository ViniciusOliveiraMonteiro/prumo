import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { AppModule } from './app.module.js';
import { configureHttp } from './http/configure-http.js';

async function bootstrap() {
  config({ path: '../.env', quiet: true });
  const app = await NestFactory.create(AppModule);
  configureHttp(app);
  await app.listen(process.env.PORT ?? 3001, '127.0.0.1');
}
await bootstrap();
