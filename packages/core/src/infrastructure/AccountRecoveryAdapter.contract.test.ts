/** Protects recovery authorization, atomicity and retry parity with real adapters. */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { AccountRecoveryApplicationService } from '../application/services/AccountRecoveryApplicationService.js';
import { AccountActionDeliveryDrainer } from '../application/services/AccountActionDeliveryDrainer.js';
import { User } from '../domain/models/User.js';
import { PasswordHasher } from './crypto/PasswordHasher.js';
import { SqliteInfrastructure } from './sqlite/SqliteInfrastructure.js';
import { PgExecutor } from './postgres/PgExecutor.js';
import { TransactionPortPostgres } from './postgres/TransactionPortPostgres.js';
import { AccessControlPortPostgres } from './postgres/AccessControlPortPostgres.js';
import { UserRepositoryPostgres } from './postgres/UserRepositoryPostgres.js';
import { SessionRepositoryPostgres } from './postgres/SessionRepositoryPostgres.js';
import { AuditPortPostgres } from './postgres/AuditPortPostgres.js';
import { AccountActionTokenPortPostgres } from './postgres/AccountActionTokenPortPostgres.js';
import { AccountActionDeliveryOutboxPostgres } from './postgres/AccountActionDeliveryOutboxPostgres.js';
import { AccountActionTokenCipherAesGcm } from './crypto/AccountActionTokenCipherAesGcm.js';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_DATABASE_ADMIN_URL;
const isTestUrl = (url: string | undefined) => Boolean(url && /(?:^|_)test(?:_|$)/.test(new URL(url).pathname.slice(1)));

async function harness(profile: 'sqlite' | 'postgres') {
  const sqlite = profile === 'sqlite' ? new SqliteInfrastructure() : undefined;
  const pool = profile === 'postgres' ? new pg.Pool({ connectionString: databaseUrl }) : undefined;
  const admin = pool ? new pg.Pool({ connectionString: adminUrl }) : undefined;
  const executor = pool ? new PgExecutor(pool) : undefined;
  const transactions = sqlite?.transactionPort ?? new TransactionPortPostgres(pool!);
  const users = sqlite?.userRepository ?? new UserRepositoryPostgres(executor!);
  const access = sqlite?.accessControlPort ?? new AccessControlPortPostgres(executor!);
  const sessions = sqlite?.sessionRepository ?? new SessionRepositoryPostgres(executor!);
  const audit = sqlite?.auditPort ?? new AuditPortPostgres(executor!);
  const tokens = sqlite?.accountActionTokenPort ?? new AccountActionTokenPortPostgres(executor!);
  const outbox = sqlite?.accountActionDeliveryOutbox ?? new AccountActionDeliveryOutboxPostgres(executor!);
  const cipher = new AccountActionTokenCipherAesGcm('12'.repeat(32));
  const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
  const drainer = new AccountActionDeliveryDrainer(outbox, cipher, delivery);
  const drain = vi.spyOn(drainer, 'drain').mockResolvedValue(0);
  const actorId = randomUUID();
  const userId = randomUUID();
  const email = `${userId}@recovery-contract.test`;
  await users.createUser(User.create(actorId, `${actorId}@recovery-contract.test`, 'unused', true));
  await users.createUser(User.create(userId, email, 'old-hash'));
  const service = new AccountRecoveryApplicationService(PasswordHasher, tokens, users, sessions, audit, transactions, access, undefined, delivery, outbox, cipher, drainer);
  return {
    service, transactions, users, sessions, audit, access, tokens, drain, actorId, userId,
    revoke: async () => {
      if (sqlite) sqlite.database.run('UPDATE users SET is_super_admin=0 WHERE id=?', [actorId]);
      else await executor!.query('UPDATE users SET is_super_admin=false WHERE id=$1', [actorId]);
    },
    counts: async () => {
      if (sqlite) return {
        tokens: sqlite.database.get<{ n: number }>('SELECT COUNT(*) AS n FROM account_action_tokens WHERE user_id=?', [userId])!.n,
        deliveries: sqlite.database.get<{ n: number }>('SELECT COUNT(*) AS n FROM account_action_delivery_outbox WHERE email=?', [email])!.n,
        audit: sqlite.database.get<{ n: number }>('SELECT COUNT(*) AS n FROM audit_logs WHERE resource_id=?', [userId])!.n,
      };
      const result = await executor!.query<{ tokens: number; deliveries: number; audit: number }>(
        `SELECT (SELECT COUNT(*)::int FROM account_action_tokens WHERE user_id=$1) AS tokens,
          (SELECT COUNT(*)::int FROM account_action_delivery_outbox WHERE email=$2) AS deliveries,
          (SELECT COUNT(*)::int FROM audit_logs WHERE resource_id=$1::text) AS audit`, [userId, email]);
      return result.rows[0];
    },
    dispose: async () => {
      vi.restoreAllMocks();
      if (sqlite) sqlite.close();
      if (admin) {
        await admin.query('DELETE FROM audit_logs WHERE resource_id=$1', [userId]);
        await admin.query('DELETE FROM account_action_delivery_outbox WHERE email=$1', [email]);
        await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[actorId, userId]]);
        await admin.end();
      }
      await pool?.end();
    },
  };
}

for (const profile of ['sqlite', 'postgres'] as const) {
  const suite = profile === 'sqlite' || (isTestUrl(databaseUrl) && isTestUrl(adminUrl)) ? describe : describe.skip;
  suite(`Account recovery ${profile} contract`, () => {
    it('rejects a revocation committed after the request starts but before its transaction', async () => {
      const h = await harness(profile);
      try {
        const run = h.transactions.runInTransaction.bind(h.transactions);
        // Deterministic interleaving: commit the revocation before entering the
        // issuance transaction. A pre-transaction authority check would be stale.
        vi.spyOn(h.transactions, 'runInTransaction').mockImplementationOnce(async (work) => {
          await run(h.revoke);
          return run(work);
        });
        await expect(h.service.issue(h.actorId, h.userId, 'password_reset')).rejects.toMatchObject({ code: 'ACCESS_FORBIDDEN' });
        expect(await h.counts()).toEqual({ tokens: 0, deliveries: 0, audit: 0 });
        expect(h.drain).not.toHaveBeenCalled();
      } finally { await h.dispose(); }
    });

    it('rolls back issuance when audit fails, then persists a complete intent on retry', async () => {
      const h = await harness(profile);
      try {
        vi.spyOn(h.audit, 'record').mockRejectedValueOnce(new Error('audit unavailable'));
        await expect(h.service.issue(h.actorId, h.userId, 'password_reset')).rejects.toThrow('audit unavailable');
        expect(await h.counts()).toEqual({ tokens: 0, deliveries: 0, audit: 0 });
        expect(h.drain).not.toHaveBeenCalled();
        await h.service.issue(h.actorId, h.userId, 'password_reset');
        expect(await h.counts()).toEqual({ tokens: 1, deliveries: 1, audit: 1 });
        expect(h.drain).toHaveBeenCalledOnce();
      } finally { await h.dispose(); }
    });

    it('preserves token, password, version and session on failure and completes once on retry', async () => {
      const h = await harness(profile);
      try {
        const { token } = await h.service.issue(h.actorId, h.userId, 'password_reset');
        const sessionHash = randomUUID();
        await h.sessions.createSession(h.userId, sessionHash, new Date(Date.now() + 60_000));
        const before = await h.users.findById(h.userId);
        vi.spyOn(h.audit, 'record').mockRejectedValueOnce(new Error('audit unavailable'));
        await expect(h.service.complete(token, 'Recovery-password-2026!')).rejects.toThrow('audit unavailable');
        expect(await h.users.findById(h.userId)).toEqual(before);
        expect(await h.sessions.getSessionUserId(sessionHash)).toBe(h.userId);
        expect((await h.counts())!.audit).toBe(1);
        await h.service.complete(token, 'Recovery-password-2026!');
        const after = await h.users.findById(h.userId);
        expect(after!.rowVersion).toBe(before!.rowVersion + 1);
        expect(PasswordHasher.verify('Recovery-password-2026!', after!.passwordHash)).toBe(true);
        expect(await h.sessions.getSessionUserId(sessionHash)).toBeNull();
        expect((await h.counts())!.audit).toBe(2);
        await expect(h.service.complete(token, 'Recovery-password-2026!')).rejects.toMatchObject({ code: 'AUTH_UNAUTHORIZED' });
      } finally { await h.dispose(); }
    });
  });
}
