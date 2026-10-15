import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module.js';

const outputPath = resolve(process.cwd(), '../contracts/openapi.json');
const checkOnly = process.argv.includes('--check');

const app = await NestFactory.create(AppModule, { logger: false });
try {
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('Prumo API')
    .setVersion('0.1.0')
    .addCookieAuth('__Host-sid')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const contents = `${JSON.stringify(document, null, 2)}\n`;

  if (checkOnly) {
    const committed = await readFile(outputPath, 'utf8');
    if (committed !== contents) {
      throw new Error('OpenAPI desatualizado. Execute pnpm contract:generate.');
    }
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, contents);
  }
} finally {
  await app.close();
}
