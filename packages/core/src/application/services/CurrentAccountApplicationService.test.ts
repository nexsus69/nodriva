import { describe, expect, it, vi } from 'vitest';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { User } from '../../domain/models/User.js';
import { CurrentAccountApplicationService } from './CurrentAccountApplicationService.js';

const user = User.create('11111111-1111-4111-8111-111111111111', 'person@example.test', PasswordHasher.hash('OldPassword!123'));

function subject() {
  const users = { findById: vi.fn().mockResolvedValue(user), updateUser: vi.fn() };
  const sessions = { deleteSessionsForUser: vi.fn() };
  const audit = { record: vi.fn() };
  const service = new CurrentAccountApplicationService(users as never, sessions as never, audit as never, {
    runInTransaction: async <T>(work: () => Promise<T>) => work(),
    runInAuthorizationMutation: async <T>(work: () => Promise<T>) => work(),
  });
  return { service, users, sessions, audit };
}

describe('CurrentAccountApplicationService', () => {
  it('requires the current password, rotates the hash, revokes sessions and audits atomically', async () => {
    const { service, users, sessions, audit } = subject();
    await service.changePassword(user.id, 'OldPassword!123', 'NewPassword!456');
    const updated = vi.mocked(users.updateUser).mock.calls[0]?.[0];
    expect(updated && PasswordHasher.verify('NewPassword!456', updated.passwordHash)).toBe(true);
    expect(sessions.deleteSessionsForUser).toHaveBeenCalledWith(user.id);
    expect(audit.record).toHaveBeenCalledWith(user.id, 'user.change_own_password', 'user', user.id, null, null, { sessionsRevoked: true });
  });

  it('rejects an invalid current password before mutating anything', async () => {
    const { service, users, sessions, audit } = subject();
    await expect(service.changePassword(user.id, 'wrong', 'NewPassword!456')).rejects.toMatchObject({ code: 'AUTH_UNAUTHORIZED' });
    expect(users.updateUser).not.toHaveBeenCalled();
    expect(sessions.deleteSessionsForUser).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
