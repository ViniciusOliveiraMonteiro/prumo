import { Test, TestingModule } from '@nestjs/testing';
import { Controller, INestApplication, Post } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { config } from 'dotenv';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureHttp } from './../src/http/configure-http.js';

config({ path: '../.env', quiet: true });

let mutations = 0;

@Controller('csrf-probe')
class CsrfProbeController {
  @Post()
  @Public()
  mutate() {
    mutations += 1;
    return { mutations };
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    mutations = 0;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [CsrfProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('allows a same-origin mutation and rejects a cross-origin mutation before the handler', async () => {
    await request(app.getHttpServer())
      .post('/api/csrf-probe')
      .set('Host', 'prumo.test')
      .set('Origin', 'https://prumo.test')
      .set('Sec-Fetch-Site', 'same-origin')
      .expect(201)
      .expect({ mutations: 1 });

    await request(app.getHttpServer())
      .post('/api/csrf-probe')
      .set('Host', 'prumo.test')
      .set('Origin', 'https://hostil.test')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);

    expect(mutations).toBe(1);
  });

  it('rejects a foreign Origin when Fetch Metadata is absent', async () => {
    await request(app.getHttpServer())
      .post('/api/csrf-probe')
      .set('Host', 'prumo.test')
      .set('Origin', 'https://hostil.test')
      .expect(403);

    expect(mutations).toBe(0);
  });

  afterEach(async () => {
    await app.close();
  });
});
