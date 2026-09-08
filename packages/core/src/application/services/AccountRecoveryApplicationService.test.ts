/** Verifies atomic account recovery issuance and completion behavior. */
import { describe, expect, it, vi } from 'vitest';
import { AccountRecoveryApplicationService } from './AccountRecoveryApplicationService.js';
import { User } from '../../domain/models/User.js';
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

function createService() {
  const tokens: AccountActionTokenPort = { create: vi.fn(), consume: vi.fn() };
  const users = {
    findById: vi.fn(), findByEmail: vi.fn(), listUsers: vi.fn(), listUsersManageableBy: vi.fn(),
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
  };
  const access = {
    assertIsSuperAdmin: vi.fn(), assertHasPermission: vi.fn(), assertCanCreateNode: vi.fn(),
    assertCanMoveNode: vi.fn(), assertCanCreateEntity: vi.fn(), assertCanEditEntity: vi.fn(),
    assertCanDeleteEntity: vi.fn(), assertCanMoveEntity: vi.fn(),
    assertCanReadNode: vi.fn(), assertHasPermissionCoverage: vi.fn(), assertHasPermissionCoverageBatch: vi.fn(),
  } satisfies AccessControlPort;
  const mfa: MfaTotpPort = {
    findByUserId: vi.fn(), savePending: vi.fn(), enable: vi.fn(), consumeRecoveryCode: vi.fn(), deleteForUser: vi.fn(),
  };
  const outbox: AccountActionDeliveryOutboxPort = { enqueue: vi.fn(), claimPending: vi.fn(), markDelivered: vi.fn(), markFailed: vi.fn() };
  const cipher: AccountActionTokenCipherPort = { encrypt: vi.fn((token) => `encrypted:${token}`), decrypt: vi.fn() };
  const delivery: AccountActionDeliveryPort = { deliver: vi.fn() };
  const drainer = { drain: vi.fn().mockResolvedValue(0) } as unknown as AccountActionDeliveryDrainer;
  return {
    service: new AccountRecoveryApplicationService(tokens, users, sessions, audit, transactions, access, mfa, delivery, outbox, cipher, drainer),
    tokens, users, sessions, mfa, audit, transactions, access, delivery, outbox, cipher, drainer,
  };
}

describe('AccountRecoveryApplicationService', () => {
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
    const service = new AccountRecoveryApplicationService(
      new AccountActionTokenPortSqlite(database), context.users, context.sessions, context.audit,
      new TransactionPortSqlite(database), context.access, context.mfa, context.delivery, new AccountActionDeliveryOutboxSqlite(database), context.cipher, context.drainer,
    );

    await expect(service.issue('admin', user.id, 'password_reset')).rejects.toThrow('audit unavailable');

    expect(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM account_action_tokens')?.count).toBe(0);
    expect(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM account_action_delivery_outbox')?.count).toBe(0);
    expect(context.drainer.drain).not.toHaveBeenCalled();
    database.close();
  });
});
