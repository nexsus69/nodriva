import { PasswordHasher } from '../../infrastructure/crypto/PasswordHasher.js';
/** Verifies atomic account recovery issuance and completion behavior. */
import { describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { AccountRecoveryApplicationService } from './AccountRecoveryApplicationService.js';
import { User } from '../../domain/models/User.js';
import { ForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import type { AccountActionTokenPort } from '../ports/AccountActionTokenPort.js';
import type { UserRepository } from '../ports/UserRepository.js';
import type { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { MfaTotpPort } from '../ports/MfaTotpPort.js';
import type { AccountActionDeliveryOutboxPort } from '../ports/AccountActionDeliveryOutboxPort.js';
import type { AccountActionTokenCipherPort } from '../ports/AccountActionTokenCipherPort.js';
import type { AccountActionDeliveryPort } from '../ports/AccountActionDeliveryPort.js';
import type { AccountActionDeliveryDrainer } from './AccountActionDeliveryDrainer.js';
import { SqliteDatabase } from '../../infrastructure/sqlite/SqliteDatabase.js';
import { ensureSqliteSchema } from '../../infrastructure/sqlite/SqliteSchema.js';
import { TransactionPortSqlite } from '../../infrastructure/sqlite/TransactionPortSqlite.js';
import { AccountActionTokenPortSqlite } from '../../infrastructure/sqlite/AccountActionTokenPortSqlite.js';
import { AccountActionDeliveryOutboxSqlite } from '../../infrastructure/sqlite/AccountActionDeliveryOutboxSqlite.js';
import { UserRepositorySqlite } from '../../infrastructure/sqlite/UserRepositorySqlite.js';
import { SessionRepositorySqlite } from '../../infrastructure/sqlite/SessionRepositorySqlite.js';
import { AuditPortSqlite } from '../../infrastructure/sqlite/AuditPortSqlite.js';

function createService() {
  const tokens: AccountActionTokenPort = { create: vi.fn(), consume: vi.fn() };
  const users = {
    findById: vi.fn(), findByEmail: vi.fn(), listUsers: vi.fn(), listUsersManageableBy: vi.fn(), listUsersManageablePage: vi.fn(),
    getUserDetailManageableBy: vi.fn(), isUserManageableBy: vi.fn(), getUserDetail: vi.fn(),
    listAllRoles: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), assignUserRoles: vi.fn(),
  } satisfies UserRepository;
  const sessions: SessionRepositoryPort = {
    createSession: vi.fn(), getSessionUserId: vi.fn(), getActiveSessionExpiry: vi.fn(), touchSession: vi.fn(),
    deleteSession: vi.fn(), deleteSessionsForUser: vi.fn(),
  };
  const audit: AuditPort = { record: vi.fn() };
  const transactions: TransactionPort = {
    runInTransaction: vi.fn(async (operation) => operation()), afterCommit: vi.fn(),
    runInAuthorizationMutation: vi.fn(async (operation) => operation()),
  };
  const access = {
    assertIsSuperAdmin: vi.fn(), assertHasPermission: vi.fn(), assertCanCreateNode: vi.fn(),
    assertCanMoveNode: vi.fn(), assertCanCreateEntity: vi.fn(), assertCanEditEntity: vi.fn(),
    assertCanDeleteEntity: vi.fn(), assertCanMoveEntity: vi.fn(),
    assertCanReadNode: vi.fn(), assertHasPermissionCoverage: vi.fn(), assertHasPermissionCoverageBatch: vi.fn(),
  } satisfies AccessControlPort;
  const mfa: MfaTotpPort = {
    findByUserId: vi.fn(), savePending: vi.fn(), promotePending: vi.fn(), consumeRecoveryCode: vi.fn(), deleteForUser: vi.fn(),
  };
  const outbox: AccountActionDeliveryOutboxPort = { enqueue: vi.fn(), claimPending: vi.fn(), markDelivered: vi.fn(), markFailed: vi.fn() };
  const cipher: AccountActionTokenCipherPort = { encrypt: vi.fn((token) => `encrypted:${token}`), decrypt: vi.fn() };
  const delivery: AccountActionDeliveryPort = { deliver: vi.fn() };
  const drainer = { drain: vi.fn().mockResolvedValue(0) } as unknown as AccountActionDeliveryDrainer;
  return {
    service: new AccountRecoveryApplicationService(PasswordHasher, tokens, users, sessions, audit, transactions, access, mfa, delivery, outbox, cipher, drainer),
    tokens, users, sessions, mfa, audit, transactions, access, delivery, outbox, cipher, drainer,
  };
}

describe('AccountRecoveryApplicationService', () => {
  it('checks authority and reads the recipient only inside the issuance transaction', async () => {
    const context = createService();
    let inTransaction = false;
    vi.mocked(context.transactions.runInTransaction).mockImplementation(async (work) => {
      inTransaction = true;
      try { return await work(); } finally { inTransaction = false; }
    });
    vi.mocked(context.access.assertIsSuperAdmin).mockImplementation(async () => {
      expect(inTransaction).toBe(true);
    });
    vi.mocked(context.users.findById).mockImplementation(async () => {
      expect(inTransaction).toBe(true);
      return User.create('recipient', 'recipient@example.test', 'unused');
    });
    await context.service.issue('admin', 'recipient', 'password_reset');
    expect(context.access.assertIsSuperAdmin).toHaveBeenCalledOnce();
  });

  it('preserves authorization denials when delivery is not configured', async () => {
    const context = createService();
    vi.mocked(context.access.assertIsSuperAdmin).mockRejectedValue(new ForbiddenError());
    const service = new AccountRecoveryApplicationService(PasswordHasher,
      context.tokens, context.users, context.sessions, context.audit, context.transactions, context.access,
    );
    await expect(service.issue('operator', 'recipient', 'password_reset')).rejects.toMatchObject({ code: 'ACCESS_FORBIDDEN' });
    expect(context.users.findById).not.toHaveBeenCalled();
    expect(context.tokens.create).not.toHaveBeenCalled();
  });

  it('rejects a weak password before consuming the one-time token', async () => {
    const context = createService();
    await expect(context.service.complete('token', 'weak')).rejects.toThrow('Invalid password');
    expect(context.tokens.consume).not.toHaveBeenCalled();
  });

  it('atomically updates the password and revokes sessions and MFA', async () => {
    const context = createService();
    const user = User.create('00000000-0000-0000-0000-000000000001', 'user@example.test', 'old-hash');
    vi.mocked(context.tokens.consume).mockResolvedValue({ userId: user.id, purpose: 'password_reset' });
    vi.mocked(context.users.findById).mockResolvedValue(user);

    await context.service.complete('token', 'StrongPassword!123');

    expect(context.users.updateUser).toHaveBeenCalledOnce();
    expect(context.sessions.deleteSessionsForUser).toHaveBeenCalledWith(user.id);
    expect(context.mfa.deleteForUser).toHaveBeenCalledWith(user.id);
  });

  it('writes the token, audit and encrypted delivery intent in one transaction, then drains after commit', async () => {
    const context = createService();
    const user = User.create('00000000-0000-0000-0000-000000000001', 'user@example.test', 'old-hash');
    vi.mocked(context.users.findById).mockResolvedValue(user);
    vi.mocked(context.transactions.runInTransaction).mockImplementation(async (operation) => {
      const value = await operation();
      const afterCommit = context.transactions.afterCommit;
      if (!afterCommit) throw new Error('afterCommit is required for this test');
      const effect = vi.mocked(afterCommit).mock.calls[0]?.[0];
      await effect?.();
      return value;
    });

    await context.service.issue('admin', user.id, 'password_reset');

    expect(context.transactions.runInTransaction).toHaveBeenCalledOnce();
    expect(context.tokens.create).toHaveBeenCalledOnce();
    expect(context.outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ email: user.email, purpose: 'password_reset', tokenCiphertext: expect.stringMatching(/^encrypted:/) }));
    expect(context.audit.record).toHaveBeenCalledWith('admin', 'user.password_reset_issued', 'user', user.id, null, null, expect.objectContaining({ deliveryId: expect.any(String) }));
    expect(context.drainer.drain).toHaveBeenCalledOnce();
  });

  it('does not schedule delivery when the atomic intent fails', async () => {
    const context = createService();
    const user = User.create('00000000-0000-0000-0000-000000000001', 'user@example.test', 'old-hash');
    vi.mocked(context.users.findById).mockResolvedValue(user);
    vi.mocked(context.audit.record).mockRejectedValue(new Error('audit unavailable'));

    await expect(context.service.issue('admin', user.id, 'invitation')).rejects.toThrow('audit unavailable');

    expect(context.transactions.afterCommit).not.toHaveBeenCalled();
    expect(context.drainer.drain).not.toHaveBeenCalled();
  });

  it('rolls back both token and delivery intent when audit recording fails', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const user = User.create('00000000-0000-0000-0000-000000000011', 'rollback@example.test', 'old-hash');
    database.run('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)', [user.id, user.email, user.passwordHash]);
    const context = createService();
    vi.mocked(context.users.findById).mockResolvedValue(user);
    vi.mocked(context.audit.record).mockRejectedValue(new Error('audit unavailable'));
    const service = new AccountRecoveryApplicationService(PasswordHasher,
      new AccountActionTokenPortSqlite(database), context.users, context.sessions, context.audit,
      new TransactionPortSqlite(database), context.access, context.mfa, context.delivery, new AccountActionDeliveryOutboxSqlite(database), context.cipher, context.drainer,
    );

    await expect(service.issue('admin', user.id, 'password_reset')).rejects.toThrow('audit unavailable');

    expect(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM account_action_tokens')?.count).toBe(0);
    expect(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM account_action_delivery_outbox')?.count).toBe(0);
    expect(context.drainer.drain).not.toHaveBeenCalled();
    database.close();
  });

  it('leaves a consumed recovery token reusable when SQLite audit persistence aborts', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const user = User.create('00000000-0000-0000-0000-000000000012', 'complete-rollback@example.test', 'old-hash');
    const users = new UserRepositorySqlite(database);
    await users.createUser(user);
    const token = 'sqlite-complete-rollback-token';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    database.run("INSERT INTO account_action_tokens(token_hash,user_id,purpose,expires_at,created_by) VALUES(?,?,'password_reset',?,?)", [tokenHash, user.id, new Date(Date.now() + 60_000).toISOString(), user.id]);
    database.exec(`CREATE TRIGGER recovery_complete_audit_fault BEFORE INSERT ON audit_logs
      WHEN NEW.resource_id='${user.id}' AND NEW.action_key='user.password_reset_completed'
      BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END`);
    const service = new AccountRecoveryApplicationService(PasswordHasher,
      new AccountActionTokenPortSqlite(database), users, new SessionRepositorySqlite(database), new AuditPortSqlite(database),
      new TransactionPortSqlite(database), createService().access,
    );
    await expect(service.complete(token, 'StrongPassword!123')).rejects.toThrow('audit unavailable');
    expect(database.get<{ consumed_at: string | null }>('SELECT consumed_at FROM account_action_tokens WHERE token_hash=?', [tokenHash])?.consumed_at).toBeNull();
    database.exec('DROP TRIGGER recovery_complete_audit_fault');
    await expect(service.complete(token, 'StrongPassword!123')).resolves.toBeUndefined();
    expect(database.get<{ consumed_at: string | null }>('SELECT consumed_at FROM account_action_tokens WHERE token_hash=?', [tokenHash])?.consumed_at).not.toBeNull();
    database.close();
  });
});
