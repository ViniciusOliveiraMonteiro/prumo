import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import {
  createServer as createHttpServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type ServerResponse,
} from 'node:http';
import {
  createServer as createHttpsServer,
  request as httpsRequest,
} from 'node:https';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http/configure-http.js';
import type { INestApplication } from '@nestjs/common';

config({ path: '../.env', quiet: true });
const connectionString = process.env.PRUMO_DATABASE_URL;
if (!connectionString) throw new Error('PRUMO_DATABASE_URL is required');
const admin = new pg.Pool({ connectionString });
const webDir = resolve(
  fileURLToPath(new URL('../../prumo-web/', import.meta.url)),
);
const people = [0, 1].map(() => ({
  email: `https-${randomUUID()}@prumo.test`,
  password: `test-password-${randomUUID()}`,
  id: '',
}));

async function freePort(): Promise<number> {
  const server = createHttpServer();
  await new Promise<void>((resolveReady) =>
    server.listen(0, '127.0.0.1', resolveReady),
  );
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP port');
  await new Promise<void>((resolveClosed) =>
    server.close(() => resolveClosed()),
  );
  return address.port;
}

test('preserves private sessions and no-store through HTTPS and the Next rewrite', async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'prumo-https-'));
  const key = join(temporary, 'key.pem');
  const certificate = join(temporary, 'cert.pem');
  const previousOrigin = process.env.PRUMO_PUBLIC_ORIGIN;
  const tsconfig = join(webDir, 'tsconfig.json');
  const tsconfigBefore = readFileSync(tsconfig);
  let app: INestApplication | undefined;
  let next: ChildProcess | undefined;
  let nextOutput = '';
  let proxy: ReturnType<typeof createHttpsServer> | undefined;
  const sharedCache = new Map<
    string,
    { status: number; headers: IncomingHttpHeaders; body: Buffer }
  >();
  let cacheHits = 0;
  let probeBuilds = 0;
  const sendCachedResponse = (
    key: string,
    status: number,
    headers: IncomingHttpHeaders,
    body: Buffer,
    outgoing: ServerResponse,
  ) => {
    const cacheControl = String(headers['cache-control'] ?? '').toLowerCase();
    if (
      !/\b(?:no-store|no-cache|private)\b/.test(cacheControl) &&
      !headers['set-cookie']
    ) {
      sharedCache.set(key, { status, headers, body });
    }
    outgoing.writeHead(status, headers);
    outgoing.end(body);
  };
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost',
        '-keyout',
        key,
        '-out',
        certificate,
      ],
      { stdio: 'ignore' },
    );
    const webPort = await freePort();
    const tlsPort = await freePort();
    process.env.PRUMO_PUBLIC_ORIGIN = `https://localhost:${tlsPort}`;

    const passwordHash = await new PasswordHasher({ logN: 10 }).hash(
      people[0].password,
    );
    for (const person of people) {
      const hash =
        person === people[0]
          ? passwordHash
          : await new PasswordHasher({ logN: 10 }).hash(person.password);
      const inserted = await admin.query<{ id: string }>(
        'INSERT INTO identity.users(email, email_normalized, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [person.email, person.email, hash],
      );
      person.id = inserted.rows[0].id;
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.listen(0, '127.0.0.1');
    const apiPort = (app.getHttpServer().address() as { port: number }).port;
    next = spawn(
      process.execPath,
      [
        'node_modules/next/dist/bin/next',
        'dev',
        '-p',
        String(webPort),
        '-H',
        '127.0.0.1',
      ],
      {
        cwd: webDir,
        env: {
          ...process.env,
          PRUMO_API_INTERNAL_ORIGIN: `http://127.0.0.1:${apiPort}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    next.stdout?.on('data', (chunk: Buffer) => {
      nextOutput += chunk.toString();
    });
    next.stderr?.on('data', (chunk: Buffer) => {
      nextOutput += chunk.toString();
    });
    proxy = createHttpsServer(
      { key: readFileSync(key), cert: readFileSync(certificate) },
      (incoming, outgoing) => {
        const cacheKey =
          incoming.method === 'GET' &&
          (incoming.url === '/api/auth/me' || incoming.url === '/__cache_probe')
            ? incoming.url
            : undefined;
        const cached = cacheKey ? sharedCache.get(cacheKey) : undefined;
        if (cached) {
          cacheHits += 1;
          outgoing.writeHead(cached.status, cached.headers);
          outgoing.end(cached.body);
          return;
        }
        if (cacheKey === '/__cache_probe') {
          probeBuilds += 1;
          sendCachedResponse(
            cacheKey,
            200,
            { 'cache-control': 'public, max-age=60' },
            Buffer.from(String(probeBuilds)),
            outgoing,
          );
          return;
        }
        const headers = { ...incoming.headers };
        delete headers['x-forwarded-host'];
        delete headers['x-forwarded-proto'];
        headers['x-forwarded-proto'] = 'https';
        const upstream = httpRequest(
          {
            hostname: '127.0.0.1',
            port: webPort,
            path: incoming.url,
            method: incoming.method,
            headers,
          },
          (response) => {
            if (!cacheKey) {
              outgoing.writeHead(response.statusCode ?? 502, response.headers);
              response.pipe(outgoing);
              return;
            }
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => {
              sendCachedResponse(
                cacheKey,
                response.statusCode ?? 502,
                response.headers,
                Buffer.concat(chunks),
                outgoing,
              );
            });
          },
        );
        upstream.on('error', () => {
          outgoing.writeHead(502);
          outgoing.end();
        });
        incoming.pipe(upstream);
      },
    );
    await new Promise<void>((resolveReady) =>
      proxy!.listen(tlsPort, '127.0.0.1', resolveReady),
    );

    const call = async (
      path: string,
      method = 'GET',
      body?: object,
      cookie?: string,
      origin?: string,
    ) => {
      const payload = body ? JSON.stringify(body) : undefined;
      return new Promise<{
        status: number;
        headers: Record<string, string | string[] | undefined>;
        body: string;
      }>((resolveResponse, reject) => {
        const request = httpsRequest(
          {
            hostname: 'localhost',
            family: 4,
            port: tlsPort,
            path,
            method,
            ca: readFileSync(certificate),
            headers: {
              ...(payload ? { 'content-type': 'application/json' } : {}),
              ...(cookie ? { cookie } : {}),
              ...(origin ? { origin } : {}),
            },
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () =>
              resolveResponse({
                status: response.statusCode ?? 0,
                headers: response.headers,
                body: Buffer.concat(chunks).toString(),
              }),
            );
          },
        );
        request.on('error', reject);
        request.end(payload);
      });
    };

    let ready = false;
    let lastReadiness = '';
    for (let attempt = 0; attempt < 60; attempt++) {
      if (next.exitCode !== null)
        throw new Error('Next.js exited before readiness');
      try {
        const response = await call('/api/health');
        lastReadiness = String(response.status);
        if (response.status === 200) {
          ready = true;
          break;
        }
      } catch (error) {
        lastReadiness = String(error);
      }
      await delay(500);
    }
    if (!ready)
      throw new Error(
        `Next rewrite unavailable: ${lastReadiness}; Next: ${nextOutput.slice(-1000)}`,
      );
    expect((await call('/__cache_probe')).body).toBe('1');
    expect((await call('/__cache_probe')).body).toBe('1');
    expect(probeBuilds).toBe(1);
    expect(cacheHits).toBe(1);
    sharedCache.clear();
    cacheHits = 0;

    const signIn = async (
      person: (typeof people)[number],
      password = person.password,
    ) => {
      const response = await call(
        '/api/auth/sign-in',
        'POST',
        {
          email: person.email,
          password,
        },
        undefined,
        process.env.PRUMO_PUBLIC_ORIGIN,
      );
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']?.[0]).toContain('__Host-sid=');
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
      expect(response.headers['set-cookie']?.[0]).toContain('Secure');
      expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');
      expect(response.headers['set-cookie']?.[0]).toContain('Path=/');
      expect(response.headers['set-cookie']?.[0]).not.toContain('Domain=');
      return response.headers['set-cookie']![0].split(';', 1)[0];
    };
    const firstCookie = await signIn(people[0]);
    const secondCookie = await signIn(people[1]);
    for (const [person, cookie] of [
      [people[0], firstCookie],
      [people[1], secondCookie],
    ] as const) {
      const me = await call('/api/auth/me', 'GET', undefined, cookie);
      expect(me.status).toBe(200);
      expect(me.headers['cache-control']).toBe('no-store');
      expect(JSON.parse(me.body)).toEqual({
        id: person.id,
        email: person.email,
      });
    }
    const anonymous = await call('/api/auth/me');
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['cache-control']).toBe('no-store');
    expect(sharedCache.size).toBe(0);
    expect(cacheHits).toBe(0);
    const hostile = await call(
      '/api/auth/sign-out',
      'POST',
      undefined,
      firstCookie,
      'https://foreign.test',
    );
    expect(hostile.status).toBe(403);
    const signOut = await call(
      '/api/auth/sign-out',
      'POST',
      undefined,
      firstCookie,
      process.env.PRUMO_PUBLIC_ORIGIN,
    );
    expect(signOut.status).toBe(204);
    expect(
      (await call('/api/auth/me', 'GET', undefined, firstCookie)).status,
    ).toBe(401);
    expect(
      (await call('/api/auth/me', 'GET', undefined, secondCookie)).status,
    ).toBe(200);

    const beforeChange = await signIn(people[0]);
    const issued = await call(
      '/api/auth/recovery-codes',
      'POST',
      { currentPassword: people[0].password },
      beforeChange,
      process.env.PRUMO_PUBLIC_ORIGIN,
    );
    expect(issued.status).toBe(201);
    expect(issued.headers['cache-control']).toBe('no-store');
    const previousCode = (JSON.parse(issued.body) as { codes: string[] })
      .codes[0];
    const changedPassword = `changed-${randomUUID()}`;
    const hostileChange = await call(
      '/api/auth/change-password',
      'POST',
      { currentPassword: people[0].password, newPassword: changedPassword },
      beforeChange,
      'https://foreign.test',
    );
    expect(hostileChange.status).toBe(403);
    const changed = await call(
      '/api/auth/change-password',
      'POST',
      { currentPassword: people[0].password, newPassword: changedPassword },
      beforeChange,
      process.env.PRUMO_PUBLIC_ORIGIN,
    );
    expect(changed.status).toBe(204);
    expect(changed.headers['cache-control']).toBe('no-store');
    expect(
      (await call('/api/auth/me', 'GET', undefined, beforeChange)).status,
    ).toBe(401);
    expect(
      (await call('/api/auth/me', 'GET', undefined, secondCookie)).status,
    ).toBe(200);
    const staleCode = await call(
      '/api/auth/recover-with-code',
      'POST',
      {
        email: people[0].email,
        code: previousCode,
        newPassword: `unused-${randomUUID()}`,
      },
      undefined,
      process.env.PRUMO_PUBLIC_ORIGIN,
    );
    expect(staleCode.status).toBe(401);
    expect(staleCode.headers['cache-control']).toBe('no-store');

    const beforeRecovery = await signIn(people[0], changedPassword);
    const freshCodes = await call(
      '/api/auth/recovery-codes',
      'POST',
      { currentPassword: changedPassword },
      beforeRecovery,
      process.env.PRUMO_PUBLIC_ORIGIN,
    );
    expect(freshCodes.status).toBe(201);
    const code = (JSON.parse(freshCodes.body) as { codes: string[] }).codes[0];
    const recoveredPassword = `recovered-${randomUUID()}`;
    const hostileRecovery = await call(
      '/api/auth/recover-with-code',
      'POST',
      { email: people[0].email, code, newPassword: recoveredPassword },
      undefined,
      'https://foreign.test',
    );
    expect(hostileRecovery.status).toBe(403);
    const recovered = await call(
      '/api/auth/recover-with-code',
      'POST',
      { email: people[0].email, code, newPassword: recoveredPassword },
      undefined,
      process.env.PRUMO_PUBLIC_ORIGIN,
    );
    expect(recovered.status).toBe(200);
    expect(recovered.headers['cache-control']).toBe('no-store');
    expect(
      (JSON.parse(recovered.body) as { codes: string[] }).codes,
    ).toHaveLength(8);
    expect(
      (await call('/api/auth/me', 'GET', undefined, beforeRecovery)).status,
    ).toBe(401);
    expect(
      (await call('/api/auth/me', 'GET', undefined, secondCookie)).status,
    ).toBe(200);
    await signIn(people[0], recoveredPassword);
    expect(sharedCache.size).toBe(0);
    expect(cacheHits).toBe(0);
  } finally {
    if (proxy)
      await new Promise<void>((resolveClosed) =>
        proxy!.close(() => resolveClosed()),
      );
    if (next && next.exitCode === null) {
      next.kill();
      await Promise.race([once(next, 'exit'), delay(5_000)]);
    }
    writeFileSync(tsconfig, tsconfigBefore);
    if (app) await app.close();
    for (const person of people) {
      if (person.id)
        await admin.query('DELETE FROM identity.users WHERE id = $1', [
          person.id,
        ]);
    }
    await admin.end();
    if (previousOrigin === undefined) delete process.env.PRUMO_PUBLIC_ORIGIN;
    else process.env.PRUMO_PUBLIC_ORIGIN = previousOrigin;
    rmSync(temporary, { recursive: true, force: true });
  }
}, 90_000);
