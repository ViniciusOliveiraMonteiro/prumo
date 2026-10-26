import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { isIP } from 'node:net';

export type EmailAdmissionResult = {
  admitted: boolean;
  retry_after: number | null;
};

export type EmailAdmissionReservation = (
  subjectKey: Buffer,
) => Promise<EmailAdmissionResult>;

const ADMISSION_TIMEOUT_MS = 1000;

export function canonicalIp(ip: string): string {
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version === 6) {
    const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    if (canonical.startsWith('::ffff:')) {
      const [high, low] = canonical.slice('::ffff:'.length).split(':');
      if (high && low) {
        const value =
          (Number.parseInt(high, 16) << 16) | Number.parseInt(low, 16);
        return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
      }
    }
    return canonical;
  }
  throw new Error('Invalid client IP');
}

export function emailAdmissionSubjectKey(ip: string, secret: Buffer): Buffer {
  if (secret.length !== 32) throw new Error('Invalid admission key length');
  return createHmac('sha256', secret)
    .update('prumo-email-admission:v1:')
    .update(canonicalIp(ip))
    .digest();
}

function singleHeader(request: IncomingMessage, name: string): string | null {
  const matches = request.rawHeaders.filter(
    (_, index) =>
      index % 2 === 0 && request.rawHeaders[index].toLowerCase() === name,
  );
  const value = request.headers[name];
  return matches.length === 1 && typeof value === 'string' ? value : null;
}

export function createEmailAdmissionServer(
  secret: Buffer,
  reserve: EmailAdmissionReservation,
): Server {
  if (secret.length !== 32) throw new Error('Invalid admission key length');
  const key = Buffer.from(secret);
  return createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (
      request.socket.remoteAddress !== '127.0.0.1' &&
      request.socket.remoteAddress !== '::1'
    ) {
      response.writeHead(403).end();
      return;
    }
    if (request.method !== 'GET' || request.url !== '/admit') {
      response.writeHead(404).end();
      return;
    }
    // The proxy subrequest must not send browser credentials or a request body.
    if (
      request.headers.cookie !== undefined ||
      request.headers['content-length'] !== undefined ||
      request.headers['transfer-encoding'] !== undefined
    ) {
      response.writeHead(400).end();
      return;
    }
    const ip = singleHeader(request, 'x-prumo-client-ip');
    if (!ip) {
      response.writeHead(400).end();
      return;
    }
    let subjectKey: Buffer;
    try {
      subjectKey = emailAdmissionSubjectKey(ip, key);
    } catch {
      response.writeHead(400).end();
      return;
    }
    let finished = false;
    const unavailable = () => {
      if (finished) return;
      finished = true;
      response.writeHead(503).end();
    };
    const timeout = setTimeout(unavailable, ADMISSION_TIMEOUT_MS);
    void Promise.resolve()
      .then(() => reserve(subjectKey))
      .then((result) => {
        if (finished) return;
        finished = true;
        if (result.admitted) {
          response.writeHead(204).end();
          return;
        }
        if (
          !Number.isSafeInteger(result.retry_after) ||
          result.retry_after === null ||
          result.retry_after < 1 ||
          result.retry_after > 300
        ) {
          response.writeHead(503).end();
          return;
        }
        response.setHeader('Retry-After', String(result.retry_after));
        response.writeHead(403).end();
      })
      .catch(unavailable)
      .finally(() => clearTimeout(timeout));
  });
}
