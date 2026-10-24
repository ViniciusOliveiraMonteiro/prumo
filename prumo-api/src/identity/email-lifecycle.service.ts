import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { sql } from 'drizzle-orm';
import { IdentityDatabase } from './identity.database.js';
import { IdentityUserRepository } from './identity-user.repository.js';

type Account = {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  email_version: number;
  verified_email_version: number | null;
  credential_version: number;
};
type Change = {
  id: string;
  new_email_normalized: string;
  old_email_normalized: string;
  from_email_version: number;
  from_credential_version: number;
  requires_old_proof: boolean;
  eligible: boolean;
  expires_at: Date;
};
type Challenge = {
  id: string;
  purpose: string;
  code_hash: string;
  email_normalized: string;
  email_version: number;
  credential_version: number;
  failed_attempts: number;
  expires_at: Date;
};
type Captured = { userId: string; to: string; purpose: string; code: string };

const hash = (id: string, code: string): string =>
  createHash('sha256').update(`prumo-email:${id}:${code}`).digest('hex');
const validCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value);

@Injectable()
export class EmailLifecycleService {
  private readonly localCapture =
    process.env.NODE_ENV === 'test' &&
    process.env.PRUMO_EMAIL_TRANSPORT === 'capture';
  private readonly key = this.localCapture ? randomBytes(32) : null;
  private readonly keyId = this.localCapture
    ? `local-test:${randomUUID()}`
    : '';
  private readonly captured: Captured[] = [];

  constructor(
    private readonly database: IdentityDatabase,
    private readonly users: IdentityUserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  private assertAvailable(): void {
    if (!this.localCapture)
      throw new ServiceUnavailableException('Email verification unavailable');
  }

  private seal(
    to: string,
    code: string,
  ): {
    ciphertext: Buffer;
    iv: Buffer;
    tag: Buffer;
  } {
    if (!this.key) throw new Error('Email capture key unavailable');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify({ to, code }), 'utf8'),
      cipher.final(),
    ]);
    return { ciphertext, iv, tag: cipher.getAuthTag() };
  }

  private open(
    ciphertext: Buffer,
    iv: Buffer,
    tag: Buffer,
  ): {
    to: string;
    code: string;
  } {
    if (!this.key) throw new Error('Email capture key unavailable');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        'utf8',
      ),
    ) as { to: string; code: string };
  }

  /** Test harness only. This does not expose messages through HTTP or logs. */
  takeCaptured(): Captured[] {
    this.assertAvailable();
    return this.captured.splice(0);
  }

  private async capturePending(): Promise<void> {
    if (!this.localCapture) return;
    const messages = await this.database.db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE identity.email_delivery_outbox
        SET status = 'discarded', payload_ciphertext = NULL,
          payload_iv = NULL, payload_tag = NULL
        WHERE status = 'pending' AND expires_at <= now()
      `);
      const pending = await tx.execute<{
        id: string;
        user_id: string;
        purpose: string | null;
        kind: string;
        payload_ciphertext: Buffer;
        payload_iv: Buffer;
        payload_tag: Buffer;
        valid: boolean;
      }>(sql`
        SELECT o.id, o.user_id, c.purpose, o.kind, o.payload_ciphertext,
          o.payload_iv, o.payload_tag,
          (u.active AND (
            (o.kind = 'change_completed' AND o.challenge_id IS NULL) OR
            (o.kind = 'challenge' AND c.id IS NOT NULL
              AND c.status = 'pending' AND c.expires_at > now()
              AND c.email_version = u.email_version
              AND c.credential_version = u.credential_version
              AND (c.request_id IS NULL OR
                (r.status = 'pending' AND r.eligible AND r.expires_at > now())))
          )) AS valid
        FROM identity.email_delivery_outbox o
        JOIN identity.users u ON u.id = o.user_id
        LEFT JOIN identity.email_challenges c ON c.id = o.challenge_id
        LEFT JOIN identity.email_change_requests r ON r.id = c.request_id
        WHERE o.status = 'pending' AND o.key_id = ${this.keyId}
          AND o.next_attempt_at <= now()
        ORDER BY o.created_at
        FOR UPDATE OF o SKIP LOCKED
      `);
      const delivered: Captured[] = [];
      for (const row of pending.rows) {
        if (row.valid) {
          const payload = this.open(
            row.payload_ciphertext,
            row.payload_iv,
            row.payload_tag,
          );
          delivered.push({
            userId: row.user_id,
            to: payload.to,
            purpose:
              row.kind === 'change_completed'
                ? 'change_completed'
                : (row.purpose ?? 'unknown'),
            code: payload.code,
          });
        }
        await tx.execute(sql`
          UPDATE identity.email_delivery_outbox
          SET status = ${row.valid ? 'captured' : 'discarded'},
            payload_ciphertext = NULL, payload_iv = NULL, payload_tag = NULL,
            attempts = attempts + 1
          WHERE id = ${row.id}
        `);
      }
      return delivered;
    });
    this.captured.push(...messages);
  }

  async status(userId: string): Promise<{
    email: string;
    verified: boolean;
    pendingChange: {
      newEmail: string;
      expiresAt: Date;
      requiresOldCode: boolean;
    } | null;
  }> {
    this.assertAvailable();
    const result = await this.database.db.execute<{
      email: string;
      email_version: number;
      verified_email_version: number | null;
      new_email_normalized: string | null;
      expires_at: Date | null;
      requires_old_proof: boolean | null;
    }>(sql`
      SELECT u.email, u.email_version, u.verified_email_version,
        r.new_email_normalized, r.expires_at, r.requires_old_proof
      FROM identity.users u
      LEFT JOIN identity.email_change_requests r
        ON r.user_id = u.id AND r.status = 'pending' AND r.expires_at > now()
      WHERE u.id = ${userId} AND u.active
    `);
    const row = result.rows[0];
    if (!row) throw new UnauthorizedException();
    return {
      email: row.email,
      verified: row.verified_email_version === row.email_version,
      pendingChange:
        row.new_email_normalized && row.expires_at
          ? {
              newEmail: row.new_email_normalized,
              expiresAt: row.expires_at,
              requiresOldCode: row.requires_old_proof === true,
            }
          : null,
    };
  }

  private async limited(
    userId: string,
    purpose: 'verify_current' | 'change_email',
  ): Promise<number | null> {
    const result = await this.database.db.execute<{
      count: string;
      retry_after: number | null;
      cooldown: number | null;
    }>(sql`
      SELECT count(*)::text AS count,
        ceil(extract(epoch from min(created_at) + interval '24 hours' - now()))::int AS retry_after,
        ceil(extract(epoch from max(created_at) + interval '60 seconds' - now()))::int AS cooldown
      FROM identity.email_issue_attempts
      WHERE user_id = ${userId} AND purpose = ${purpose}
        AND admitted AND created_at > now() - interval '24 hours'
    `);
    const row = result.rows[0];
    if (Number(row.count) >= 5) return Math.max(1, row.retry_after ?? 1);
    if ((row.cooldown ?? 0) > 0) return row.cooldown;
    return null;
  }

  private async passwordRetryAfter(userId: string): Promise<number | null> {
    const result = await this.database.db.execute<{ retry_after: number }>(sql`
      SELECT greatest(1, ceil(extract(epoch from
        window_started_at + interval '15 minutes' - now())))::int AS retry_after
      FROM identity.email_current_password_attempts
      WHERE user_id = ${userId} AND attempts >= 5
        AND window_started_at > now() - interval '15 minutes'
    `);
    return result.rows[0]?.retry_after ?? null;
  }

  private async recordPasswordFailure(userId: string): Promise<number | null> {
    await this.database.db.execute(sql`
      INSERT INTO identity.email_current_password_attempts AS current
        (user_id, window_started_at, attempts)
      VALUES (${userId}, now(), 1)
      ON CONFLICT (user_id) DO UPDATE SET
        window_started_at = CASE
          WHEN current.window_started_at <= now() - interval '15 minutes'
          THEN now() ELSE current.window_started_at END,
        attempts = CASE
          WHEN current.window_started_at <= now() - interval '15 minutes'
          THEN 1 ELSE least(current.attempts + 1, 5) END
    `);
    return this.passwordRetryAfter(userId);
  }

  async requestVerification(userId: string): Promise<number | null> {
    this.assertAvailable();
    const retryAfter = await this.limited(userId, 'verify_current');
    if (retryAfter !== null) return retryAfter;
    await this.database.db.transaction(async (tx) => {
      const found = await tx.execute<Account>(sql`
        SELECT * FROM identity.users WHERE id = ${userId} AND active FOR UPDATE
      `);
      const user = found.rows[0];
      if (!user) throw new UnauthorizedException();
      const count = await tx.execute<{
        count: string;
        latest: Date | null;
      }>(sql`
        SELECT count(*)::text AS count, max(created_at) AS latest
        FROM identity.email_issue_attempts
        WHERE user_id = ${userId} AND purpose = 'verify_current'
          AND admitted AND created_at > now() - interval '24 hours'
      `);
      if (
        Number(count.rows[0].count) >= 5 ||
        (count.rows[0].latest &&
          Date.now() - new Date(count.rows[0].latest).getTime() < 60_000)
      )
        throw new HttpException(
          'Too many requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      await tx.execute(sql`
        INSERT INTO identity.email_issue_attempts(user_id, purpose, admitted)
        VALUES (${userId}, 'verify_current', true)
      `);
      if (user.verified_email_version === user.email_version) return;
      await tx.execute(sql`
        UPDATE identity.email_challenges SET status = 'cancelled'
        WHERE user_id = ${userId} AND purpose = 'verify_current' AND status = 'pending'
      `);
      const id = randomUUID();
      const code = randomBytes(16).toString('base64url');
      const payload = this.seal(user.email_normalized, code);
      await tx.execute(sql`
        INSERT INTO identity.email_challenges
          (id, user_id, purpose, email_normalized, email_version,
           credential_version, code_hash, status, expires_at)
        VALUES (${id}, ${userId}, 'verify_current', ${user.email_normalized},
          ${user.email_version}, ${user.credential_version}, ${hash(id, code)},
          'pending', now() + interval '30 minutes')
      `);
      await tx.execute(sql`
        INSERT INTO identity.email_delivery_outbox
          (challenge_id, user_id, payload_ciphertext, payload_iv,
           payload_tag, key_id, status, expires_at)
        VALUES (${id}, ${userId}, ${payload.ciphertext}, ${payload.iv},
          ${payload.tag}, ${this.keyId}, 'pending', now() + interval '30 minutes')
      `);
      await tx.execute(sql`
        INSERT INTO identity.email_events(user_id, kind, challenge_id)
        VALUES (${userId}, 'verification_requested', ${id})
      `);
    });
    await this.capturePending();
    return null;
  }

  async confirmVerification(userId: string, code: string): Promise<void> {
    this.assertAvailable();
    if (!validCode(code))
      throw new UnprocessableEntityException('Invalid proof');
    const success = await this.database.db.transaction(async (tx) => {
      const user = (
        await tx.execute<Account>(sql`
        SELECT * FROM identity.users WHERE id = ${userId} AND active FOR UPDATE
      `)
      ).rows[0];
      if (!user) throw new UnauthorizedException();
      const challenge = (
        await tx.execute<Challenge>(sql`
        SELECT * FROM identity.email_challenges
        WHERE user_id = ${userId} AND purpose = 'verify_current' AND status = 'pending'
        FOR UPDATE
      `)
      ).rows[0];
      if (
        !challenge ||
        new Date(challenge.expires_at).getTime() <= Date.now() ||
        challenge.email_normalized !== user.email_normalized ||
        challenge.email_version !== user.email_version ||
        challenge.credential_version !== user.credential_version
      )
        return false;
      if (challenge.code_hash !== hash(challenge.id, code)) {
        await tx.execute(sql`
          UPDATE identity.email_challenges
          SET failed_attempts = failed_attempts + 1,
            status = CASE WHEN failed_attempts >= 4 THEN 'cancelled' ELSE status END
          WHERE id = ${challenge.id}
        `);
        return false;
      }
      await tx.execute(sql`
        UPDATE identity.users SET verified_email_version = email_version,
          updated_at = now() WHERE id = ${userId}
      `);
      await tx.execute(sql`
        UPDATE identity.email_challenges SET status = 'consumed'
        WHERE id = ${challenge.id}
      `);
      await tx.execute(sql`
        INSERT INTO identity.email_events(user_id, kind, challenge_id)
        VALUES (${userId}, 'email_verified', ${challenge.id})
      `);
      return true;
    });
    if (!success) throw new UnprocessableEntityException('Invalid proof');
  }

  async requestChange(
    userId: string,
    newEmail: string,
    currentPassword: string,
  ): Promise<number | null> {
    this.assertAvailable();
    const passwordRetryAfter = await this.passwordRetryAfter(userId);
    if (passwordRetryAfter !== null) return passwordRetryAfter;
    const credentials = await this.users.findActiveCredentialsById(userId);
    if (
      !credentials ||
      !(await this.hasher.verify(currentPassword, credentials.passwordHash))
    ) {
      const retryAfter = await this.recordPasswordFailure(userId);
      if (retryAfter !== null) return retryAfter;
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.database.db.execute(sql`
      DELETE FROM identity.email_current_password_attempts WHERE user_id = ${userId}
    `);
    const retryAfter = await this.limited(userId, 'change_email');
    if (retryAfter !== null) return retryAfter;
    await this.database.db.transaction(async (tx) => {
      const user = (
        await tx.execute<Account>(sql`
        SELECT * FROM identity.users WHERE id = ${userId} AND active FOR UPDATE
      `)
      ).rows[0];
      if (!user || user.password_hash !== credentials.passwordHash)
        throw new UnauthorizedException('Invalid credentials');
      if (newEmail === user.email_normalized)
        throw new UnprocessableEntityException('Invalid change');
      const count = await tx.execute<{
        count: string;
        latest: Date | null;
      }>(sql`
        SELECT count(*)::text AS count, max(created_at) AS latest
        FROM identity.email_issue_attempts
        WHERE user_id = ${userId} AND purpose = 'change_email'
          AND admitted AND created_at > now() - interval '24 hours'
      `);
      if (
        Number(count.rows[0].count) >= 5 ||
        (count.rows[0].latest &&
          Date.now() - new Date(count.rows[0].latest).getTime() < 60_000)
      )
        throw new HttpException(
          'Too many requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      await tx.execute(sql`
        INSERT INTO identity.email_issue_attempts(user_id, purpose, admitted)
        VALUES (${userId}, 'change_email', true)
      `);
      await tx.execute(sql`
        UPDATE identity.email_change_requests SET status = 'cancelled'
        WHERE user_id = ${userId} AND status = 'pending'
      `);
      await tx.execute(sql`
        UPDATE identity.email_challenges SET status = 'cancelled'
        WHERE user_id = ${userId} AND purpose IN ('change_old', 'change_new')
          AND status = 'pending'
      `);
      const occupied = await tx.execute<{ id: string }>(sql`
        SELECT id FROM identity.users WHERE email_normalized = ${newEmail}
        LIMIT 1
      `);
      const eligible = occupied.rows.length === 0;
      const requestId = randomUUID();
      const requiresOldProof =
        user.verified_email_version === user.email_version;
      await tx.execute(sql`
        INSERT INTO identity.email_change_requests
          (id, user_id, old_email_normalized, new_email_normalized,
           from_email_version, from_credential_version, requires_old_proof,
           eligible, status, expires_at)
        VALUES (${requestId}, ${userId}, ${user.email_normalized}, ${newEmail},
          ${user.email_version}, ${user.credential_version},
          ${requiresOldProof}, ${eligible}, 'pending', now() + interval '30 minutes')
      `);
      {
        const targets = requiresOldProof
          ? [
              { purpose: 'change_old', to: user.email_normalized },
              { purpose: 'change_new', to: newEmail },
            ]
          : [{ purpose: 'change_new', to: newEmail }];
        for (const target of targets) {
          const id = randomUUID();
          const code = randomBytes(16).toString('base64url');
          const payload = this.seal(target.to, code);
          await tx.execute(sql`
            INSERT INTO identity.email_challenges
              (id, user_id, request_id, purpose, email_normalized,
               email_version, credential_version, code_hash, status, expires_at)
            VALUES (${id}, ${userId}, ${requestId}, ${target.purpose},
              ${target.to}, ${user.email_version}, ${user.credential_version},
              ${hash(id, code)}, 'pending', now() + interval '30 minutes')
          `);
          await tx.execute(sql`
            INSERT INTO identity.email_delivery_outbox
              (challenge_id, user_id, payload_ciphertext, payload_iv,
               payload_tag, key_id, status, expires_at)
            VALUES (${id}, ${userId}, ${payload.ciphertext}, ${payload.iv},
              ${payload.tag}, ${this.keyId}, 'pending', now() + interval '30 minutes')
          `);
        }
      }
      await tx.execute(sql`
        INSERT INTO identity.email_events(user_id, kind, request_id)
        VALUES (${userId}, 'change_requested', ${requestId})
      `);
    });
    await this.capturePending();
    return null;
  }

  async confirmChange(
    userId: string,
    newCode: string,
    oldCode?: string,
  ): Promise<void> {
    this.assertAvailable();
    if (!validCode(newCode) || (oldCode !== undefined && !validCode(oldCode)))
      throw new UnprocessableEntityException('Invalid proof');
    let succeeded = false;
    try {
      succeeded = await this.database.db.transaction(async (tx) => {
        const user = (
          await tx.execute<Account>(sql`
          SELECT * FROM identity.users WHERE id = ${userId} AND active FOR UPDATE
        `)
        ).rows[0];
        if (!user) throw new UnauthorizedException();
        const change = (
          await tx.execute<Change>(sql`
          SELECT * FROM identity.email_change_requests
          WHERE user_id = ${userId} AND status = 'pending' FOR UPDATE
        `)
        ).rows[0];
        if (
          !change ||
          !change.eligible ||
          new Date(change.expires_at).getTime() <= Date.now() ||
          change.old_email_normalized !== user.email_normalized ||
          change.from_email_version !== user.email_version ||
          change.from_credential_version !== user.credential_version ||
          change.requires_old_proof !==
            (user.verified_email_version === user.email_version)
        )
          return false;
        const challenges = (
          await tx.execute<Challenge & { purpose: string }>(sql`
          SELECT * FROM identity.email_challenges
          WHERE request_id = ${change.id} AND status = 'pending'
          ORDER BY purpose FOR UPDATE
        `)
        ).rows;
        const newer = challenges.find((item) => item.purpose === 'change_new');
        const older = challenges.find((item) => item.purpose === 'change_old');
        const expected = change.requires_old_proof ? [newer, older] : [newer];
        if (
          expected.some(
            (item) =>
              !item ||
              new Date(item.expires_at).getTime() <= Date.now() ||
              item.email_version !== user.email_version ||
              item.credential_version !== user.credential_version,
          ) ||
          (change.requires_old_proof && !oldCode)
        )
          return false;
        const invalid = [
          newer && newer.code_hash !== hash(newer.id, newCode) ? newer : null,
          older && oldCode && older.code_hash !== hash(older.id, oldCode)
            ? older
            : null,
        ].filter(
          (item): item is Challenge => item !== null && item !== undefined,
        );
        for (const item of invalid) {
          await tx.execute(sql`
            UPDATE identity.email_challenges
            SET failed_attempts = failed_attempts + 1,
              status = CASE WHEN failed_attempts >= 4 THEN 'cancelled' ELSE status END
            WHERE id = ${item.id}
          `);
        }
        if (invalid.length) return false;
        await tx.execute(sql`
          UPDATE identity.users SET email = ${change.new_email_normalized},
            email_normalized = ${change.new_email_normalized},
            email_version = email_version + 1,
            verified_email_version = email_version + 1,
            credential_version = credential_version + 1, updated_at = now()
          WHERE id = ${userId}
        `);
        await tx.execute(sql`
          DELETE FROM identity.sessions WHERE user_id = ${userId}
        `);
        await tx.execute(sql`
          UPDATE identity.email_challenges SET status = 'cancelled'
          WHERE user_id = ${userId} AND status = 'pending'
        `);
        await tx.execute(sql`
          UPDATE identity.email_change_requests SET status = 'completed'
          WHERE id = ${change.id}
        `);
        await tx.execute(sql`
          INSERT INTO identity.email_events(user_id, kind, request_id)
          VALUES (${userId}, 'email_changed', ${change.id})
        `);
        if (change.requires_old_proof) {
          const notice = this.seal(change.old_email_normalized, '');
          await tx.execute(sql`
            INSERT INTO identity.email_delivery_outbox
              (user_id, payload_ciphertext, payload_iv, payload_tag,
               key_id, kind, status, expires_at)
            VALUES (${userId}, ${notice.ciphertext}, ${notice.iv}, ${notice.tag},
              ${this.keyId}, 'change_completed', 'pending', now() + interval '30 minutes')
          `);
        }
        return true;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new UnprocessableEntityException('Invalid proof');
      throw error;
    }
    if (!succeeded) throw new UnprocessableEntityException('Invalid proof');
    await this.capturePending();
  }

  async cancelChange(userId: string): Promise<void> {
    this.assertAvailable();
    await this.database.db.transaction(async (tx) => {
      const user = (
        await tx.execute<Account>(sql`
        SELECT * FROM identity.users WHERE id = ${userId} AND active FOR UPDATE
      `)
      ).rows[0];
      if (!user) throw new UnauthorizedException();
      const cancelled = await tx.execute<{ id: string }>(sql`
        UPDATE identity.email_change_requests SET status = 'cancelled'
        WHERE user_id = ${userId} AND status = 'pending' RETURNING id
      `);
      if (!cancelled.rows.length) return;
      await tx.execute(sql`
        UPDATE identity.email_challenges SET status = 'cancelled'
        WHERE user_id = ${userId} AND purpose IN ('change_old', 'change_new')
          AND status = 'pending'
      `);
      await tx.execute(sql`
        INSERT INTO identity.email_events(user_id, kind, request_id)
        VALUES (${userId}, 'change_cancelled', ${cancelled.rows[0].id})
      `);
    });
  }
}
