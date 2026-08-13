import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityAdminApplicationService } from './SecurityAdminApplicationService.js';
import type { SecurityRepository } from '../ports/SecurityRepository.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { UserRepository } from '../ports/UserRepository.js';
import { Role } from '../../domain/models/Role.js';
import {
  RoleKeyAlreadyExistsError,
  SystemRoleForbiddenError,
} from '../../domain/errors/SecurityAdminErrors.js';

const ROLE_ID = '00000000-0000-0000-0000-000000000030';
const ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000010';
const NODE_ID = '00000000-0000-0000-0000-000000000050';
const PERM_ID_1 = '00000000-0000-0000-0000-000000000060';

describe('SecurityAdminApplicationService', () => {
  let mockSecurityRepository: SecurityRepository;
  let mockAuditPort: AuditPort;
  let mockTransactionPort: TransactionPort;
  let mockIdGenerator: IdGeneratorPort;
  let mockAccessControlPort: AccessControlPort;
  let mockUserRepository: UserRepository;
  let service: SecurityAdminApplicationService;

  beforeEach(() => {
    mockSecurityRepository = {
      listRoles: vi.fn().mockResolvedValue([]),
      getRoleByKey: vi.fn(),
      findRoleById: vi.fn().mockResolvedValue(Role.create(ROLE_ID, 'delegable_role', 'Delegable role')),
      findRoleByKey: vi.fn(),
      listRolePermissionKeys: vi.fn().mockResolvedValue([]),
      createRole: vi.fn().mockResolvedValue(undefined),
      updateRole: vi.fn().mockResolvedValue(undefined),
      updateRolePermissions: vi.fn().mockResolvedValue(undefined),
      listAllPermissions: vi.fn().mockResolvedValue([]),
      listScopeAssignments: vi.fn().mockResolvedValue([]),
      listScopeAssignmentsManageableBy: vi.fn().mockResolvedValue([]),
      getScopeAssignmentById: vi.fn(),
      getScopeAssignmentManageableBy: vi.fn(),
      revokeDelegatedScopeAssignmentsOutsideCoverage: vi.fn().mockResolvedValue([]),
      listRealtimeScopeAssignments: vi.fn().mockResolvedValue([]),
      listRealtimeVirtualRootNodeIds: vi.fn().mockResolvedValue([]),
      createScopeAssignment: vi.fn().mockResolvedValue(undefined),
      updateScopeAssignment: vi.fn().mockResolvedValue(undefined),
      deleteScopeAssignment: vi.fn().mockResolvedValue(undefined),
    };

    mockAuditPort = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    mockTransactionPort = {
      runInTransaction: vi.fn().mockImplementation(async (work) => await work()),
    };

    mockIdGenerator = {
      generate: vi.fn().mockReturnValue(ROLE_ID),
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

    mockUserRepository = {
      findById: vi.fn(), findByEmail: vi.fn(), listUsers: vi.fn(), listUsersManageableBy: vi.fn(),
      getUserDetailManageableBy: vi.fn(), isUserManageableBy: vi.fn().mockResolvedValue(true),
      getUserDetail: vi.fn(), listAllRoles: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), assignUserRoles: vi.fn(),
    };

    service = new SecurityAdminApplicationService(
      mockSecurityRepository,
      mockAuditPort,
      mockTransactionPort,
      mockIdGenerator,
      mockAccessControlPort,
      mockUserRepository,
    );
  });

  it('should create a role successfully', async () => {
    vi.mocked(mockSecurityRepository.findRoleByKey).mockResolvedValue(null);

    const role = await service.createRole({
      roleKey: 'custom_role',
      name: 'Custom Role',
      description: 'Test description',
      permissionIds: [PERM_ID_1],
      actorUserId: ACTOR_ID,
    });

    expect(role.roleKey).toBe('custom_role');
    expect(mockSecurityRepository.createRole).toHaveBeenCalled();
    expect(mockAuditPort.record).toHaveBeenCalledWith(
      ACTOR_ID,
      'security.create_role',
      'role',
      ROLE_ID,
      null,
      null,
      expect.any(Object)
    );
  });

  it('should throw RoleKeyAlreadyExistsError if roleKey is taken', async () => {
    vi.mocked(mockSecurityRepository.findRoleByKey).mockResolvedValue(
      Role.create(ROLE_ID, 'custom_role', 'Custom Role')
    );

    await expect(
      service.createRole({
        roleKey: 'custom_role',
        name: 'Custom Role',
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow(RoleKeyAlreadyExistsError);
  });

  it('should throw SystemRoleForbiddenError when trying to edit a system role', async () => {
    const systemRole = new Role(ROLE_ID, 'super_admin', 'Super Admin', '', true, 1, new Date(), new Date());
    vi.mocked(mockSecurityRepository.findRoleByKey).mockResolvedValue(systemRole);

    await expect(
      service.updateRolePermissions({
        roleKey: 'super_admin',
        permissionIds: [PERM_ID_1],
        expectedRowVersion: 1,
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow(SystemRoleForbiddenError);
  });

  it('should create scope assignment successfully', async () => {
    await service.createScopeAssignment({
      userId: USER_ID,
      nodeId: NODE_ID,
      roleId: ROLE_ID,
      assignmentEffect: 'allow',
      propagation: 'subtree',
      actorUserId: ACTOR_ID,
    });

    expect(mockSecurityRepository.createScopeAssignment).toHaveBeenCalledWith(
      ROLE_ID,
      USER_ID,
      NODE_ID,
      ROLE_ID,
      'allow',
      'subtree',
      ACTOR_ID
    );
    expect(mockSecurityRepository.revokeDelegatedScopeAssignmentsOutsideCoverage).toHaveBeenCalledTimes(1);
  });

  it('rejects scope mutations for a target identity outside the actor boundary', async () => {
    vi.mocked(mockUserRepository.isUserManageableBy).mockResolvedValue(false);

    await expect(service.createScopeAssignment({
      userId: USER_ID,
      nodeId: NODE_ID,
      roleId: ROLE_ID,
      assignmentEffect: 'deny',
      propagation: 'self',
      actorUserId: ACTOR_ID,
    })).rejects.toThrow('outside');

    expect(mockSecurityRepository.createScopeAssignment).not.toHaveBeenCalled();
  });

  it('audits each automatically cascaded delegated grant', async () => {
    vi.mocked(mockSecurityRepository.revokeDelegatedScopeAssignmentsOutsideCoverage).mockResolvedValue([{
      id: '00000000-0000-0000-0000-000000000071', userId: USER_ID, nodeId: NODE_ID,
      roleId: ROLE_ID, assignedBy: ACTOR_ID,
    }]);

    await service.createScopeAssignment({
      userId: USER_ID, nodeId: NODE_ID, roleId: ROLE_ID,
      assignmentEffect: 'deny', propagation: 'self', actorUserId: ACTOR_ID,
    });

    expect(mockAuditPort.record).toHaveBeenCalledWith(
      ACTOR_ID, 'security.revoke_delegated_scope', 'scope_assignment',
      '00000000-0000-0000-0000-000000000071', NODE_ID,
      expect.objectContaining({ assignedBy: ACTOR_ID }), expect.objectContaining({ reason: expect.any(String) }),
    );
  });

  it('rejects an allow assignment when the role contains a permission the actor cannot delegate', async () => {
    vi.mocked(mockSecurityRepository.listRolePermissionKeys).mockResolvedValue(['entity.delete']);
    vi.mocked(mockAccessControlPort.assertHasPermissionCoverageBatch).mockRejectedValueOnce(new Error('Denied'));

    await expect(service.createScopeAssignment({
      userId: USER_ID,
      nodeId: NODE_ID,
      roleId: ROLE_ID,
      assignmentEffect: 'allow',
      propagation: 'subtree',
      actorUserId: ACTOR_ID,
    })).rejects.toThrow('Denied');

    expect(mockSecurityRepository.createScopeAssignment).not.toHaveBeenCalled();
  });

  it('should update scope assignment successfully', async () => {
    vi.mocked(mockSecurityRepository.getScopeAssignmentManageableBy).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000070',
      userId: USER_ID,
      userEmail: 'user@example.com',
      nodeId: NODE_ID,
      nodeName: 'Node',
      roleId: ROLE_ID,
      roleName: 'Role',
      assignmentEffect: 'allow',
      propagation: 'subtree',
      assignedAt: new Date().toISOString(),
    });
    await service.updateScopeAssignment({
      assignmentId: '00000000-0000-0000-0000-000000000070',
      roleId: ROLE_ID,
      assignmentEffect: 'deny',
      propagation: 'self',
      actorUserId: ACTOR_ID,
    });

    expect(mockSecurityRepository.updateScopeAssignment).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000070',
      ROLE_ID,
      'deny',
      'self'
    );
    expect(mockAccessControlPort.assertHasPermissionCoverage).toHaveBeenCalledWith(
      ACTOR_ID,
      'scope.assign',
      NODE_ID,
      'self'
    );
  });
});
