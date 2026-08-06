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

function createService() {
  const tokens: AccountActionTokenPort = { create: vi.fn(), consume: vi.fn() };
  const users = {
    findById: vi.fn(), findByEmail: vi.fn(), listUsers: vi.fn(), listUsersManageableBy: vi.fn(),
    getUserDetailManageableBy: vi.fn(), isUserManageableBy: vi.fn(), getUserDetail: vi.fn(),
    listAllRoles: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), assignUserRoles: vi.fn(),
  } satisfies UserRepository;
  const sessions: SessionRepositoryPort = {
    createSession: vi.fn(), getSessionUserId: vi.fn(), deleteSession: vi.fn(), deleteSessionsForUser: vi.fn(),
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
  return { service: new AccountRecoveryApplicationService(tokens, users, sessions, audit, transactions, access, mfa), tokens, users, sessions, mfa };
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
});
