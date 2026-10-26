import { randomBytes } from 'node:crypto';
import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { config } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
  canonicalIp,
  createEmailAdmissionServer,
  emailAdmissionSubjectKey,
} from '../src/edge/email-admission.js';

config({ path: '../.env', quiet: true });
const ownerUrl = process.env.PRUMO_DATABASE_URL;
if (!ownerUrl) throw new Error('PRUMO_DATABASE_URL is required');

const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
const schema = `edge_counter_lab_${suffix}`;
const role = `edge_counter_lab_${suffix}`;
const password = randomBytes(24).toString('hex');
const owner = new pg.Pool({ connectionString: ownerUrl });
const edgeUrl = new URL(ownerUrl);
edgeUrl.username = role;
edgeUrl.password = password;
const edge = new pg.Pool({ connectionString: edgeUrl.toString(), max: 12 });
const key = () => randomBytes(32);

type Reservation = { admitted: boolean; retry_after: number | null };

async function reserve(subjectKey: Buffer): Promise<Reservation> {
  const result = await edge.query<Reservation>(
    `SELECT admitted, retry_after FROM ${schema}.reserve_email_request($1)`,
    [subjectKey],
  );
  return result.rows[0];
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function call(
  port: number,
  path: string,
  method = 'GET',
  headers: Record<string, string> = {},
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
}> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { hostname: '127.0.0.1', port, path, method, headers },
      (response) => {
        response.resume();
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
          }),
        );
      },
    );
    request.on('error', reject);
    request.setTimeout(3000, () =>
      request.destroy(new Error('HTTP laboratory request timed out')),
    );
    request.end();
  });
}

beforeAll(async () => {
  await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
  await owner.query(`CREATE SCHEMA ${schema}`);
  await owner.query(`
    CREATE TABLE ${schema}.email_request_windows (
      subject_key bytea PRIMARY KEY,
      admitted_at timestamptz[] NOT NULL DEFAULT '{}',
      touched_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT subject_key_sha256 CHECK (octet_length(subject_key) = 32),
      CONSTRAINT at_most_30 CHECK (cardinality(admitted_at) <= 30)
    );

    CREATE FUNCTION ${schema}.reserve_email_request(p_key bytea)
    RETURNS TABLE(admitted boolean, retry_after integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = pg_catalog, pg_temp AS $$
    DECLARE
      live_times timestamptz[];
      decision_time timestamptz;
    BEGIN
      INSERT INTO ${schema}.email_request_windows(subject_key)
      VALUES (p_key) ON CONFLICT DO NOTHING;

      SELECT admitted_at INTO live_times
      FROM ${schema}.email_request_windows
      WHERE subject_key = p_key FOR UPDATE;

      decision_time := clock_timestamp();
      SELECT COALESCE(array_agg(entry_time ORDER BY entry_time), '{}'::timestamptz[])
      INTO live_times
      FROM unnest(live_times) AS entries(entry_time)
      WHERE entry_time > decision_time - interval '300 seconds';

      IF cardinality(live_times) < 30 THEN
        UPDATE ${schema}.email_request_windows
        SET admitted_at = array_append(live_times, decision_time),
            touched_at = decision_time
        WHERE subject_key = p_key;
        RETURN QUERY SELECT true, NULL::integer;
      ELSE
        RETURN QUERY SELECT false,
          greatest(1, ceil(extract(epoch FROM
            (live_times[1] + interval '300 seconds' - decision_time)))::integer);
      END IF;
    END;
    $$;

    REVOKE ALL ON FUNCTION ${schema}.reserve_email_request(bytea) FROM PUBLIC;
    GRANT USAGE ON SCHEMA ${schema} TO ${role};
    GRANT EXECUTE ON FUNCTION ${schema}.reserve_email_request(bytea) TO ${role};
  `);
});

afterAll(async () => {
  await edge.end();
  await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await owner.query(`DROP ROLE IF EXISTS ${role}`);
  await owner.end();
});

test('shares 30 slots, rejects the 31st without extending the window, and isolates keys', async () => {
  const subject = key();
  for (let index = 0; index < 30; index += 1) {
    expect(await reserve(subject)).toEqual({
      admitted: true,
      retry_after: null,
    });
  }
  const beforeRejections = await owner.query<{ admitted_at: Date[] }>(
    `SELECT admitted_at FROM ${schema}.email_request_windows WHERE subject_key = $1`,
    [subject],
  );
  const rejected = await reserve(subject);
  expect(rejected.admitted).toBe(false);
  expect(rejected.retry_after).toBeGreaterThan(0);
  expect(rejected.retry_after).toBeLessThanOrEqual(300);
  expect((await reserve(subject)).admitted).toBe(false);
  expect((await reserve(key())).admitted).toBe(true);

  const state = await owner.query<{ count: number; admitted_at: Date[] }>(
    `SELECT cardinality(admitted_at) AS count, admitted_at
     FROM ${schema}.email_request_windows WHERE subject_key = $1`,
    [subject],
  );
  expect(state.rows[0].count).toBe(30);
  expect(state.rows[0].admitted_at).toEqual(
    beforeRejections.rows[0].admitted_at,
  );
});

test('admits after all prior slots leave the rolling window', async () => {
  const subject = key();
  await owner.query(
    `INSERT INTO ${schema}.email_request_windows(subject_key, admitted_at)
     VALUES ($1, array_fill(clock_timestamp() - interval '301 seconds', ARRAY[30]))`,
    [subject],
  );
  expect(await reserve(subject)).toEqual({ admitted: true, retry_after: null });
  const state = await owner.query<{ count: number }>(
    `SELECT cardinality(admitted_at) AS count
     FROM ${schema}.email_request_windows WHERE subject_key = $1`,
    [subject],
  );
  expect(state.rows[0].count).toBe(1);
});

test('admits exactly 30 of 60 concurrent requests with one shared database key', async () => {
  const subject = key();
  const results = await Promise.all(
    Array.from({ length: 60 }, () => reserve(subject)),
  );
  expect(results.filter(({ admitted }) => admitted)).toHaveLength(30);
  expect(results.filter(({ admitted }) => !admitted)).toHaveLength(30);
});

test('restricted edge role cannot read counters or identity data', async () => {
  const privileges = await edge.query<{
    counter_select: boolean;
    identity_usage: boolean;
  }>(`
    SELECT has_table_privilege(current_user, '${schema}.email_request_windows', 'SELECT') AS counter_select,
           has_schema_privilege(current_user, 'identity', 'USAGE') AS identity_usage
  `);
  expect(privileges.rows[0]).toEqual({
    counter_select: false,
    identity_usage: false,
  });
});

test('canonicalizes IP addresses and requires a separate 256-bit HMAC key', () => {
  const secret = randomBytes(32);
  expect(canonicalIp('2001:0db8:0:0::1')).toBe('2001:db8::1');
  expect(emailAdmissionSubjectKey('2001:0db8:0:0::1', secret)).toEqual(
    emailAdmissionSubjectKey('2001:db8::1', secret),
  );
  expect(canonicalIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
  expect(emailAdmissionSubjectKey('::ffff:127.0.0.1', secret)).toEqual(
    emailAdmissionSubjectKey('127.0.0.1', secret),
  );
  expect(emailAdmissionSubjectKey('127.0.0.1', secret)).not.toEqual(
    emailAdmissionSubjectKey('127.0.0.2', secret),
  );
  expect(() => emailAdmissionSubjectKey('not-an-ip', secret)).toThrow();
  expect(() =>
    emailAdmissionSubjectKey('127.0.0.1', randomBytes(16)),
  ).toThrow();
});

test('admits through an internal HTTP service and a local proxy harness', async () => {
  const secret = randomBytes(32);
  let failReservation = false;
  let hangReservation = false;
  let forwarded = 0;
  const admission = createEmailAdmissionServer(secret, async (subjectKey) => {
    if (failReservation) throw new Error('injected database failure');
    if (hangReservation) return new Promise<Reservation>(() => {});
    return reserve(subjectKey);
  });
  const admissionPort = await listen(admission);
  const proxy = createServer((incoming, outgoing) => {
    void (async () => {
      const protectedPost =
        incoming.method === 'POST' &&
        (incoming.url === '/api/auth/email-verification' ||
          incoming.url === '/api/auth/email-changes');
      if (protectedPost) {
        let decision: Awaited<ReturnType<typeof call>>;
        try {
          decision = await call(admissionPort, '/admit', 'GET', {
            // Deliberately use the connection, never client-supplied headers.
            'x-prumo-client-ip': incoming.socket.remoteAddress ?? '',
          });
        } catch {
          outgoing.writeHead(503, { 'cache-control': 'no-store' }).end();
          return;
        }
        if (decision.status === 403) {
          outgoing
            .writeHead(429, {
              'cache-control': 'no-store',
              'retry-after': String(decision.headers['retry-after'] ?? '1'),
            })
            .end();
          return;
        }
        if (decision.status !== 204) {
          outgoing.writeHead(503, { 'cache-control': 'no-store' }).end();
          return;
        }
      }
      forwarded += 1;
      outgoing
        .writeHead(
          incoming.method === 'POST' &&
            incoming.headers.origin === 'https://bad.test'
            ? 403
            : incoming.method === 'POST'
              ? 202
              : 405,
          { 'cache-control': 'no-store' },
        )
        .end();
    })();
  });
  const proxyPort = await listen(proxy);
  try {
    expect(
      (await call(admissionPort, '/admit', 'GET', { cookie: 'sid=never' }))
        .status,
    ).toBe(400);
    expect((await call(admissionPort, '/admit')).status).toBe(400);
    expect(
      (await call(proxyPort, '/api/auth/email-verification', 'GET')).status,
    ).toBe(405);
    expect(
      (
        await call(proxyPort, '/api/auth/email-verification', 'POST', {
          origin: 'https://bad.test',
          'x-forwarded-for': '198.51.100.7',
        })
      ).status,
    ).toBe(403);
    for (let index = 0; index < 29; index += 1) {
      const route =
        index % 2 === 0
          ? '/api/auth/email-changes'
          : '/api/auth/email-verification';
      const response = await call(proxyPort, route, 'POST', {
        'x-forwarded-for': `198.51.100.${index + 1}`,
        forwarded: 'for=203.0.113.5',
        'x-prumo-client-ip': `192.0.2.${index + 1}`,
      });
      expect(response.status).toBe(202);
    }
    const beforeRejected = forwarded;
    const rejected = await call(
      proxyPort,
      '/api/auth/email-verification',
      'POST',
      { 'x-forwarded-for': '192.0.2.55' },
    );
    expect(rejected.status).toBe(429);
    expect(rejected.headers['cache-control']).toBe('no-store');
    expect(Number(rejected.headers['retry-after'])).toBeGreaterThan(0);
    expect(forwarded).toBe(beforeRejected);
    failReservation = true;
    const unavailable = await call(
      proxyPort,
      '/api/auth/email-changes',
      'POST',
    );
    expect(unavailable.status).toBe(503);
    expect(forwarded).toBe(beforeRejected);
    failReservation = false;
    hangReservation = true;
    const timedOut = await call(
      proxyPort,
      '/api/auth/email-verification',
      'POST',
    );
    expect(timedOut.status).toBe(503);
    expect(forwarded).toBe(beforeRejected);
  } finally {
    await close(proxy);
    await close(admission);
  }
});
