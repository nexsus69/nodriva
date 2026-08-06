import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserAdminApplicationService } from './UserAdminApplicationService.js';
import { UserRepository } from '../ports/UserRepository.js';
import { AuditPort } from '../ports/AuditPort.js';
import { TransactionPort } from '../ports/TransactionPort.js';
import { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import { AccessControlPort } from '../ports/AccessControlPort.js';
import { User } from '../../domain/models/User.js';
import {
  UserEmailAlreadyExistsError,
  UserAdminValidationError,
} from '../../domain/errors/UserAdminErrors.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { ForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';

const USER_ID = '00000000-0000-0000-0000-000000000010';
const ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const ROLE_ID_1 = '00000000-0000-0000-0000-000000000020';
const ROLE_ID_2 = '00000000-0000-0000-0000-000000000021';

describe('UserAdminApplicationService', () => {
  let mockUserRepository: UserRepository;
  let mockAuditPort: AuditPort;
  let mockTransactionPort: TransactionPort;
  let mockIdGenerator: IdGeneratorPort;
  let mockAccessControlPort: AccessControlPort;
  let mockSessionRepository: SessionRepositoryPort;
  let service: UserAdminApplicationService;

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      listUsers: vi.fn().mockResolvedValue([]),
      listUsersManageableBy: vi.fn().mockResolvedValue([]),
      getUserDetailManageableBy: vi.fn(),
      isUserManageableBy: vi.fn().mockResolvedValue(true),
      getUserDetail: vi.fn(),
      listAllRoles: vi.fn().mockResolvedValue([]),
      createUser: vi.fn().mockResolvedValue(undefined),
      updateUser: vi.fn().mockResolvedValue(undefined),
      assignUserRoles: vi.fn().mockResolvedValue(undefined),
    };

    mockAuditPort = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    mockTransactionPort = {
      runInTransaction: vi.fn().mockImplementation(async (work) => await work()),
    };

    mockIdGenerator = {
      generate: vi.fn().mockReturnValue(USER_ID),
    };

    mockAccessControlPort = {
      assertCanReadNode: vi.fn(),
      assertCanCreateEntity: vi.fn(),
      assertCanEditEntity: vi.fn(),
      assertCanDeleteEntity: vi.fn(),
      assertCanCreateNode: vi.fn(),
      assertCanMoveNode: vi.fn(),
      assertCanMoveEntity: vi.fn(),
      assertHasPermission: vi.fn().mockResolvedValue(undefined),
      assertHasPermissionCoverage: vi.fn().mockResolvedValue(undefined),
      assertHasPermissionCoverageBatch: vi.fn().mockResolvedValue(undefined),
      assertIsSuperAdmin: vi.fn().mockResolvedValue(undefined),
    };

    mockSessionRepository = {
      createSession: vi.fn(),
      getSessionUserId: vi.fn(),
      getActiveSessionExpiry: vi.fn(),
      touchSession: vi.fn(),
      deleteSession: vi.fn(),
      deleteSessionsForUser: vi.fn(),
    };

    service = new UserAdminApplicationService(
      mockUserRepository,
      mockAuditPort,
      mockTransactionPort,
      mockIdGenerator,
      mockAccessControlPort,
      mockSessionRepository
    );
  });

  it('should create a new user successfully and record audit', async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(mockUserRepository.findById).mockResolvedValue(
      User.create(ACTOR_ID, 'admin@mate.com', 'hash', true)
    );

    const user = await service.createUser({
      email: 'new.user@mate.com',
      password: 'StrongPassword!123',
      isSuperAdmin: false,
      actorUserId: ACTOR_ID,
    });

    expect(user.id).toBe(USER_ID);
    expect(user.email).toBe('new.user@mate.com');
    expect(user.passwordHash).not.toBe('StrongPassword!123');
    expect(PasswordHasher.verify('StrongPassword!123', user.passwordHash)).toBe(true);
    expect(mockUserRepository.createUser).toHaveBeenCalled();
    expect(mockAuditPort.record).toHaveBeenCalledWith(
      ACTOR_ID,
      'user.create',
      'user',
      USER_ID,
      null,
      null,
      expect.any(Object)
    );
  });

  it('should authorize user list and detail reads', async () => {
    vi.mocked(mockUserRepository.findById).mockResolvedValue(
      User.create(ACTOR_ID, 'admin@mate.com', 'hash', true)
    );
    await service.listUsers(ACTOR_ID);
    await service.getUserById(ACTOR_ID, USER_ID);

    expect(mockUserRepository.listUsersManageableBy).toHaveBeenCalledWith(ACTOR_ID);
    expect(mockUserRepository.getUserDetailManageableBy).toHaveBeenCalledWith(ACTOR_ID, USER_ID);
  });

  it('should throw UserEmailAlreadyExistsError if email is taken', async () => {
    vi.mocked(mockUserRepository.findById).mockResolvedValue(
      User.create(ACTOR_ID, 'admin@mate.com', 'hash', true)
    );
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(
      User.create(USER_ID, 'taken@mate.com', 'hash')
    );

    await expect(
      service.createUser({
        email: 'taken@mate.com',
        password: 'StrongPassword!123',
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow(UserEmailAlreadyExistsError);
  });

  it('should throw ForbiddenError if user does not have permission', async () => {
    vi.mocked(mockAccessControlPort.assertHasPermission).mockRejectedValue(new ForbiddenError('Denied'));
    await expect(
      service.createUser({
        email: 'denied@mate.com',
        password: 'StrongPassword!123',
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('should update user status successfully', async () => {
    const existingUser = User.create(USER_ID, 'active@mate.com', 'hash');
    const superAdmin = User.create(ACTOR_ID, 'admin@mate.com', 'hash', true);
    vi.mocked(mockUserRepository.findById).mockImplementation(async (id) =>
      id === ACTOR_ID ? superAdmin : existingUser
    );

    const updated = await service.updateUserStatus({
      userId: USER_ID,
      isActive: false,
      expectedRowVersion: 1,
      actorUserId: ACTOR_ID,
    });

    expect(updated.isActive).toBe(false);
    expect(updated.rowVersion).toBe(2);
    expect(mockUserRepository.updateUser).toHaveBeenCalled();
  });

  it('should throw RowVersionMismatchError if rowVersion does not match during status update', async () => {
    const existingUser = User.create(USER_ID, 'active@mate.com', 'hash');
    const superAdmin = User.create(ACTOR_ID, 'admin@mate.com', 'hash', true);
    vi.mocked(mockUserRepository.findById).mockImplementation(async (id) =>
      id === ACTOR_ID ? superAdmin : existingUser
    );

    await expect(
      service.updateUserStatus({
        userId: USER_ID,
        isActive: false,
        expectedRowVersion: 99, // mismatch
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow(RowVersionMismatchError);
  });

  it('should assign user roles successfully', async () => {
    const existingUser = User.create(USER_ID, 'user@mate.com', 'hash');
    const superAdmin = User.create(ACTOR_ID, 'admin@mate.com', 'hash', true);
    vi.mocked(mockUserRepository.findById)
      .mockResolvedValueOnce(superAdmin)
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce(superAdmin);

    await service.assignUserRoles({
      userId: USER_ID,
      roleIds: [ROLE_ID_1, ROLE_ID_2],
      expectedRowVersion: 1,
      actorUserId: ACTOR_ID,
    });

    expect(mockUserRepository.assignUserRoles).toHaveBeenCalledWith(USER_ID, [ROLE_ID_1, ROLE_ID_2]);
    expect(mockAuditPort.record).toHaveBeenCalledWith(
      ACTOR_ID,
      'user.assign_roles',
      'user',
      USER_ID,
      null,
      null,
      { roleIds: [ROLE_ID_1, ROLE_ID_2] }
    );
  });

  it('rejects global role assignment by a non-super-admin even with user.assign_roles', async () => {
    const existingUser = User.create(USER_ID, 'user@mate.com', 'hash');
    const nonSuperAdmin = User.create(ACTOR_ID, 'operator@mate.com', 'hash');
    vi.mocked(mockUserRepository.findById)
      .mockResolvedValueOnce(nonSuperAdmin);

    await expect(service.assignUserRoles({
      userId: existingUser.id,
      roleIds: [ROLE_ID_1],
      expectedRowVersion: 1,
      actorUserId: ACTOR_ID,
    })).rejects.toThrow(ForbiddenError);

    expect(mockUserRepository.assignUserRoles).not.toHaveBeenCalled();
  });

  it('rejects user creation by a non-super-admin even with user.create', async () => {
    vi.mocked(mockUserRepository.findById).mockResolvedValue(
      User.create(ACTOR_ID, 'operator@mate.com', 'hash')
    );

    await expect(service.createUser({
      email: 'new.user@mate.com',
      password: 'StrongPassword!123',
      actorUserId: ACTOR_ID,
    })).rejects.toThrow(ForbiddenError);

    expect(mockUserRepository.createUser).not.toHaveBeenCalled();
  });

  it('should hash a reset password, persist it, revoke sessions, and audit', async () => {
    const existingUser = User.create(USER_ID, 'user@mate.com', PasswordHasher.hash('OldPassword!123'));
    const actor = User.create(ACTOR_ID, 'admin@mate.com', 'hash', true);
    vi.mocked(mockUserRepository.findById)
      .mockResolvedValueOnce(actor)
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce(actor);

    const updated = await service.resetUserPassword({
      userId: USER_ID,
      newPassword: 'NewPassword!456',
      expectedRowVersion: 1,
      actorUserId: ACTOR_ID,
    });

    expect(updated.rowVersion).toBe(2);
    expect(updated.passwordHash).not.toBe('NewPassword!456');
    expect(PasswordHasher.verify('NewPassword!456', updated.passwordHash)).toBe(true);
    expect(mockUserRepository.updateUser).toHaveBeenCalledWith(updated);
    expect(mockSessionRepository.deleteSessionsForUser).toHaveBeenCalledWith(USER_ID);
    expect(mockAuditPort.record).toHaveBeenCalledWith(
      ACTOR_ID,
      'user.reset_password',
      'user',
      USER_ID,
      null,
      null,
      { sessionsRevoked: true, mfaRevoked: false }
    );
  });

  it('should revoke sessions when disabling a user', async () => {
    const existingUser = User.create(USER_ID, 'active@mate.com', 'hash');
    const superAdmin = User.create(ACTOR_ID, 'admin@mate.com', 'hash', true);
    vi.mocked(mockUserRepository.findById).mockImplementation(async (id) =>
      id === ACTOR_ID ? superAdmin : existingUser
    );

    await service.updateUserStatus({
      userId: USER_ID,
      isActive: false,
      expectedRowVersion: 1,
      actorUserId: ACTOR_ID,
    });

    expect(mockSessionRepository.deleteSessionsForUser).toHaveBeenCalledWith(USER_ID);
  });

  it('rejects self-disabling before opening a transaction', async () => {
    await expect(service.updateUserStatus({
      userId: ACTOR_ID,
      isActive: false,
      expectedRowVersion: 1,
      actorUserId: ACTOR_ID,
    })).rejects.toThrow(UserAdminValidationError);

    expect(mockTransactionPort.runInTransaction).not.toHaveBeenCalled();
    expect(mockUserRepository.updateUser).not.toHaveBeenCalled();
  });
});
