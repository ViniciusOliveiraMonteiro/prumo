import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createEmailAdmissionServer } from '../dist/edge/email-admission.js';

const fixture = resolve('test/fixtures/nginx-email-admission.conf');
const socketDir = await mkdtemp(join(tmpdir(), 'prumo-nginx-lab-'));
await chmod(socketDir, 0o700);
const admissionSocket = join(socketDir, 'admission.sock');
const apiSocket = join(socketDir, 'api.sock');
const hostPort = 20000 + Math.floor(Math.random() * 20000);
let admitted = 0;
let forwarded = 0;
let unavailable = false;
const observedKeys = [];

function listen(server, socketPath) {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolveListen);
  });
}

function close(server) {
  return new Promise((resolveClose) => server.close(resolveClose));
}

const admission = createEmailAdmissionServer(
  randomBytes(32),
  async (subjectKey) => {
    observedKeys.push(subjectKey.toString('hex'));
    if (unavailable) throw new Error('injected counter failure');
    if (admitted >= 30) return { admitted: false, retry_after: 17 };
    admitted += 1;
    return { admitted: true, retry_after: null };
  },
);
const api = createServer((request, response) => {
  forwarded += 1;
  assert.equal(request.headers['x-forwarded-for'], undefined);
  assert.equal(request.headers['x-prumo-client-ip'], undefined);
  response
    .writeHead(request.headers.origin === 'https://bad.test' ? 403 : 202, {
      'Cache-Control': 'no-store',
    })
    .end();
});

let nginx;
try {
  await listen(admission, admissionSocket);
  await listen(api, apiSocket);
  await chmod(admissionSocket, 0o600);
  await chmod(apiSocket, 0o600);
  nginx = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--user',
      `${process.getuid()}:${process.getgid()}`,
      '-p',
      `127.0.0.1:${hostPort}:8080`,
      '-v',
      `${fixture}:/etc/nginx/nginx.conf:ro`,
      '-v',
      `${socketDir}:/run/prumo-lab`,
      'nginx:stable-alpine',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let dockerError = '';
  nginx.stderr.on('data', (data) => {
    dockerError += data.toString();
  });
  const base = `http://127.0.0.1:${hostPort}`;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (nginx.exitCode !== null) throw new Error(dockerError || 'Nginx exited');
    try {
      const response = await fetch(`${base}/_email_admit`);
      if (response.status === 404) {
        ready = true;
        break;
      }
    } catch {
      /* Container has not opened its port yet. */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  assert.ok(ready, dockerError || 'Nginx did not become ready');

  async function call(path, options = {}) {
    return fetch(`${base}${path}`, { method: 'POST', ...options });
  }
  const wrongMethod = await fetch(`${base}/api/auth/email-verification`);
  assert.equal(wrongMethod.status, 405);
  assert.equal(admitted, 0);
  const csrf = await call('/api/auth/email-verification', {
    headers: { Origin: 'https://bad.test', 'X-Forwarded-For': '198.51.100.7' },
  });
  assert.equal(
    csrf.status,
    403,
    JSON.stringify({ admitted, forwarded, dockerError }),
  );
  for (let index = 1; index < 30; index += 1) {
    const path =
      index % 2 ? '/api/auth/email-changes' : '/api/auth/email-verification';
    const response = await call(path, {
      headers: {
        'X-Forwarded-For': `198.51.100.${index}`,
        'X-Prumo-Client-IP': `203.0.113.${index}`,
      },
    });
    assert.equal(response.status, 202);
  }
  assert.equal(admitted, 30);
  assert.equal(forwarded, 30);
  assert.equal(new Set(observedKeys).size, 1);
  const denied = await call('/api/auth/email-verification');
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get('retry-after'), '17');
  assert.equal(denied.headers.get('cache-control'), 'no-store');
  assert.equal(forwarded, 30);
  for (const variant of [
    '/api/auth/email-verification/',
    '/api/auth/EMAIL-VERIFICATION',
    '/api/auth/email-changes/',
    '/api/auth/EMAIL-CHANGES',
  ]) {
    const response = await call(variant);
    assert.equal(response.status, 429, variant);
    assert.equal(forwarded, 30);
  }
  const confirmation = await call('/api/auth/email-verification/confirm');
  assert.equal(confirmation.status, 202);
  assert.equal(admitted, 30);
  assert.equal(forwarded, 31);
  unavailable = true;
  const failed = await call('/api/auth/email-changes');
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('cache-control'), 'no-store');
  assert.equal(forwarded, 31);
  console.log(
    'Nginx smoke passed: 30/31, route variants, 403 preserved, 429/Retry-After, forged headers, fail closed',
  );
} finally {
  nginx?.kill('SIGINT');
  await close(admission);
  await close(api);
  await rm(socketDir, { recursive: true, force: true });
}
