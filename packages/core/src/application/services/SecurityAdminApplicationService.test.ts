import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityAdminApplicationService } from './SecurityAdminApplicationService.js';
import { SecurityRepository } from '../ports/SecurityRepository.js';
import { AuditPort } from '../ports/AuditPort.js';
import { TransactionPort } from '../ports/TransactionPort.js';
import { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import { AccessControlPort } from '../ports/AccessControlPort.js';
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
  let service: SecurityAdminApplicationService;

  beforeEach(() => {
    mockSecurityRepository = {
      listRoles: vi.fn().mockResolvedValue([]),
      getRoleByKey: vi.fn(),
      findRoleById: vi.fn(),
      findRoleByKey: vi.fn(),
      createRole: vi.fn().mockResolvedValue(undefined),
      updateRole: vi.fn().mockResolvedValue(undefined),
      updateRolePermissions: vi.fn().mockResolvedValue(undefined),
      listAllPermissions: vi.fn().mockResolvedValue([]),
      listScopeAssignments: vi.fn().mockResolvedValue([]),
      getScopeAssignmentById: vi.fn(),
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
      assertCanCreateNode: vi.fn(),
      assertCanMoveNode: vi.fn(),
      assertCanMoveEntity: vi.fn(),
      assertHasPermission: vi.fn().mockResolvedValue(undefined),
    };

    service = new SecurityAdminApplicationService(
      mockSecurityRepository,
      mockAuditPort,
      mockTransactionPort,
      mockIdGenerator,
      mockAccessControlPort
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
  });

  it('should update scope assignment successfully', async () => {
    vi.mocked(mockSecurityRepository.getScopeAssignmentById).mockResolvedValue({
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
    expect(mockAccessControlPort.assertHasPermission).toHaveBeenCalledWith(
      ACTOR_ID,
      'scope.assign',
      NODE_ID
    );
  });
});
