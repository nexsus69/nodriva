/** Orchestrates role and scope administration while preserving authorization and audit invariants. */
import type { SecurityRepository } from '../ports/SecurityRepository.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { UserRepository } from '../ports/UserRepository.js';
import { ForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import { Role } from '../../domain/models/Role.js';
import type {
  RoleListItemDto,
  RoleListPageDto,
  RoleListPageParams,
  RoleDetailDto,
  PermissionDto,
  ScopeAssignmentDto,
  ScopeAssignmentListPageDto,
  ScopeAssignmentListPageParams,
} from '../dto/SecurityAdminDtos.js';
import type {
  CreateRoleCommand,
  UpdateRoleMetadataCommand,
  UpdateRolePermissionsCommand,
  UpdateRoleCommand,
  CreateScopeAssignmentCommand,
  DeleteScopeAssignmentCommand,
  UpdateScopeAssignmentCommand} from '../commands/SecurityAdminCommands.js';
import { CreateRoleCommandSchema, UpdateRoleCommandSchema, UpdateRoleMetadataCommandSchema, UpdateRolePermissionsCommandSchema, CreateScopeAssignmentCommandSchema, DeleteScopeAssignmentCommandSchema, UpdateScopeAssignmentCommandSchema,
} from '../commands/SecurityAdminCommands.js';
import {
  RoleNotFoundError,
  RoleKeyAlreadyExistsError,
  SystemRoleForbiddenError,
  SecurityAdminValidationError,
} from '../../domain/errors/SecurityAdminErrors.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type { z } from 'zod';

export class SecurityAdminApplicationService {
  constructor(
    private readonly securityRepository: SecurityRepository,
    private readonly auditPort: AuditPort,
    private readonly transactionPort: TransactionPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly accessControlPort: AccessControlPort,
    private readonly userRepository: UserRepository,
  ) {}

  async listRoles(actorUserId: string): Promise<RoleListItemDto[]> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'role.read', null);
    await this.accessControlPort.assertIsSuperAdmin(actorUserId);
    return await this.securityRepository.listRoles();
  }

  async listRolesPage(actorUserId: string, params: RoleListPageParams): Promise<RoleListPageDto> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'role.read', null);
    await this.accessControlPort.assertIsSuperAdmin(actorUserId);
    return await this.securityRepository.listRolesPage(params);
  }

  async getRoleByKey(actorUserId: string, roleKey: string): Promise<RoleDetailDto | null> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'role.read', null);
    await this.accessControlPort.assertIsSuperAdmin(actorUserId);
    return await this.securityRepository.getRoleByKey(roleKey);
  }

  async listPermissions(actorUserId: string): Promise<PermissionDto[]> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'role.read', null);
    await this.accessControlPort.assertIsSuperAdmin(actorUserId);
    return await this.securityRepository.listAllPermissions();
  }

  async createRole(cmd: CreateRoleCommand): Promise<Role> {
    const v = this.validateCommand(CreateRoleCommandSchema, cmd, 'creating role');
    return await this.runAuthorizationMutation(async () => {
      await this.accessControlPort.assertHasPermission(v.actorUserId, 'role.create', null);
      await this.accessControlPort.assertIsSuperAdmin(v.actorUserId);
      const existing = await this.securityRepository.findRoleByKey(v.roleKey);
      if (existing) {
        throw new RoleKeyAlreadyExistsError(v.roleKey);
      }

      const roleId = this.idGenerator.generate();
      const role = Role.create(roleId, v.roleKey, v.name, v.description ?? '');

      await this.securityRepository.createRole(role, v.permissionIds ?? []);
      await this.auditPort.record(
        v.actorUserId,
        'security.create_role',
        'role',
        role.id,
        null,
        null,
        { roleKey: role.roleKey, name: role.name, permissionIds: v.permissionIds ?? [] }
      );

      return role;
    });
  }

  async updateRolePermissions(cmd: UpdateRolePermissionsCommand): Promise<void> {
    const v = this.validateCommand(UpdateRolePermissionsCommandSchema, cmd, 'updating role permissions');
    return await this.runAuthorizationMutation(async () => {
      await this.accessControlPort.assertHasPermission(v.actorUserId, 'role.update', null);
      await this.accessControlPort.assertIsSuperAdmin(v.actorUserId);
      const role = await this.securityRepository.findRoleByKey(v.roleKey);
      if (!role) {
        throw new RoleNotFoundError(v.roleKey);
      }

      if (role.isSystem) {
        throw new SystemRoleForbiddenError(role.roleKey);
      }

      if (role.rowVersion !== v.expectedRowVersion) {
        throw new RowVersionMismatchError(v.expectedRowVersion, role.rowVersion);
      }

      const updated = new Role(
        role.id,
        role.roleKey,
        role.name,
        role.description,
        role.isSystem,
        role.rowVersion + 1,
        role.createdAt,
        new Date(),
        role.deletedAt
      );

      await this.securityRepository.updateRole(updated);
      await this.securityRepository.updateRolePermissions(role.id, v.permissionIds);
      await this.reconcileDelegatedScopes(v.actorUserId, 'role permissions changed');
      await this.auditPort.record(
        v.actorUserId,
        'security.update_role_permissions',
        'role',
        role.id,
        null,
        null,
        { permissionIds: v.permissionIds }
      );
    });
  }

  async updateRoleMetadata(cmd: UpdateRoleMetadataCommand): Promise<void> {
    const v = this.validateCommand(UpdateRoleMetadataCommandSchema, cmd, 'updating role metadata');
    return await this.runAuthorizationMutation(async () => {
      await this.accessControlPort.assertHasPermission(v.actorUserId, 'role.update', null);
      await this.accessControlPort.assertIsSuperAdmin(v.actorUserId);
      const role = await this.securityRepository.findRoleByKey(v.roleKey);
      if (!role) throw new RoleNotFoundError(v.roleKey);
      if (role.isSystem) throw new SystemRoleForbiddenError(role.roleKey);
      if (role.rowVersion !== v.expectedRowVersion) throw new RowVersionMismatchError(v.expectedRowVersion, role.rowVersion);
      await this.securityRepository.updateRole(new Role(role.id, role.roleKey, v.name, v.description ?? '', role.isSystem, role.rowVersion + 1, role.createdAt, new Date(), role.deletedAt));
      await this.auditPort.record(v.actorUserId, 'security.update_role', 'role', role.id, null, { name: role.name, description: role.description }, { name: v.name, description: v.description ?? '' });
    });
  }

  /** Updates role metadata and permissions in the same transaction and audit event. */
  async updateRole(cmd: UpdateRoleCommand): Promise<void> {
    const v = this.validateCommand(UpdateRoleCommandSchema, cmd, 'updating role');
    return await this.runAuthorizationMutation(async () => {
      await this.accessControlPort.assertHasPermission(v.actorUserId, 'role.update', null);
      await this.accessControlPort.assertIsSuperAdmin(v.actorUserId);
      const role = await this.securityRepository.findRoleByKey(v.roleKey);
      if (!role) throw new RoleNotFoundError(v.roleKey);
      if (role.isSystem) throw new SystemRoleForbiddenError(role.roleKey);
      if (role.rowVersion !== v.expectedRowVersion) {
        throw new RowVersionMismatchError(v.expectedRowVersion, role.rowVersion);
      }
      const previousPermissionKeys = await this.securityRepository.listRolePermissionKeys(role.id);
      const updated = new Role(
        role.id,
        role.roleKey,
        v.name,
        v.description ?? '',
        role.isSystem,
        role.rowVersion + 1,
        role.createdAt,
        new Date(),
        role.deletedAt,
      );
      await this.securityRepository.updateRole(updated);
      await this.securityRepository.updateRolePermissions(role.id, v.permissionIds);
      await this.reconcileDelegatedScopes(v.actorUserId, 'role changed');
      await this.auditPort.record(
        v.actorUserId,
        'security.update_role',
        'role',
        role.id,
        null,
        {
          roleKey: role.roleKey,
          name: role.name,
          description: role.description,
          permissionKeys: previousPermissionKeys,
          rowVersion: role.rowVersion,
        },
        {
          roleKey: updated.roleKey,
          name: updated.name,
          description: updated.description,
          permissionIds: v.permissionIds,
          rowVersion: updated.rowVersion,
        },
      );
    });
  }

  async listScopeAssignments(actorUserId: string): Promise<ScopeAssignmentDto[]> {
    return await this.securityRepository.listScopeAssignmentsManageableBy(actorUserId);
  }

  async listScopeAssignmentsPage(
    actorUserId: string,
    params: ScopeAssignmentListPageParams,
  ): Promise<ScopeAssignmentListPageDto> {
    return await this.securityRepository.listScopeAssignmentsManageablePage(actorUserId, params);
  }

  async createScopeAssignment(cmd: CreateScopeAssignmentCommand): Promise<void> {
    const v = this.validateCommand(CreateScopeAssignmentCommandSchema, cmd, 'creating scope assignment');
    return await this.runAuthorizationMutation(async () => {
      await this.assertTargetUserManageable(v.actorUserId, v.userId);
      await this.accessControlPort.assertHasPermissionCoverage(v.actorUserId, 'scope.assign', v.nodeId, v.propagation);
      if (v.assignmentEffect === 'allow') await this.assertCanDelegateRole(v.actorUserId, v.roleId, v.nodeId, v.propagation);
      const assignmentId = this.idGenerator.generate();

      await this.securityRepository.createScopeAssignment(
        assignmentId,
        v.userId,
        v.nodeId,
        v.roleId,
        v.assignmentEffect,
        v.propagation,
        v.actorUserId
      );

      await this.auditPort.record(
        v.actorUserId,
        'security.create_scope_assignment',
        'scope_assignment',
        assignmentId,
        v.nodeId,
        null,
        { userId: v.userId, nodeId: v.nodeId, roleId: v.roleId, effect: v.assignmentEffect, propagation: v.propagation }
      );
      await this.reconcileDelegatedScopes(v.actorUserId, 'scope assignment created');
    });
  }

  async updateScopeAssignment(cmd: UpdateScopeAssignmentCommand): Promise<void> {
    const v = this.validateCommand(UpdateScopeAssignmentCommandSchema, cmd, 'updating scope assignment');
    return await this.runAuthorizationMutation(async () => {
      const assignment = await this.securityRepository.getScopeAssignmentManageableBy(v.actorUserId, v.assignmentId);
      if (!assignment) throw new SecurityAdminValidationError(`Scope assignment '${v.assignmentId}' not found.`);
      await this.assertTargetUserManageable(v.actorUserId, assignment.userId);
      await this.accessControlPort.assertHasPermissionCoverage(v.actorUserId, 'scope.assign', assignment.nodeId, v.propagation);
      if (v.assignmentEffect === 'allow') await this.assertCanDelegateRole(v.actorUserId, v.roleId, assignment.nodeId, v.propagation);
      await this.securityRepository.updateScopeAssignment(
        v.assignmentId,
        v.roleId,
        v.assignmentEffect,
        v.propagation
      );

      await this.auditPort.record(
        v.actorUserId,
        'security.update_scope_assignment',
        'scope_assignment',
        v.assignmentId,
        assignment.nodeId,
        {
          roleId: assignment.roleId,
          effect: assignment.assignmentEffect,
          propagation: assignment.propagation,
        },
        { roleId: v.roleId, effect: v.assignmentEffect, propagation: v.propagation }
      );
      await this.reconcileDelegatedScopes(v.actorUserId, 'scope assignment updated');
    });
  }

  async deleteScopeAssignment(cmd: DeleteScopeAssignmentCommand): Promise<void> {
    const v = this.validateCommand(DeleteScopeAssignmentCommandSchema, cmd, 'deleting scope assignment');
    return await this.runAuthorizationMutation(async () => {
      const assignment = await this.securityRepository.getScopeAssignmentManageableBy(v.actorUserId, v.assignmentId);
      if (!assignment) throw new SecurityAdminValidationError(`Scope assignment '${v.assignmentId}' not found.`);
      await this.assertTargetUserManageable(v.actorUserId, assignment.userId);
      await this.accessControlPort.assertHasPermission(v.actorUserId, 'scope.delete', assignment.nodeId);
      await this.securityRepository.deleteScopeAssignment(v.assignmentId);
      await this.auditPort.record(
        v.actorUserId,
        'security.delete_scope_assignment',
        'scope_assignment',
        v.assignmentId,
        assignment.nodeId,
        {
          userId: assignment.userId,
          roleId: assignment.roleId,
          effect: assignment.assignmentEffect,
          propagation: assignment.propagation,
        },
        null
      );
      await this.reconcileDelegatedScopes(v.actorUserId, 'scope assignment deleted');
    });
  }

  private validateCommand<T>(schema: z.ZodSchema<T>, raw: unknown, actionName: string): T {
    const res = schema.safeParse(raw);
    if (!res.success) {
      const issues: Record<string, string[]> = {};
      for (const issue of res.error.issues) {
        const key = issue.path.join('.') || 'root';
        if (!issues[key]) issues[key] = [];
        issues[key].push(issue.message);
      }
      throw new SecurityAdminValidationError(`Validation failed for ${actionName}.`, issues);
    }
    return res.data;
  }

  /**
   * An allow scope assignment delegates every permission contained in the
   * selected role. The actor must hold every one of those permissions on the
   * very same node/sottoalbero; otherwise the assignment would be a privilege
   * escalation path.
   */
  private async assertCanDelegateRole(
    actorUserId: string,
    roleId: string,
    nodeId: string,
    propagation: 'self' | 'subtree'
  ): Promise<void> {
    const role = await this.securityRepository.findRoleById(roleId);
    if (!role) throw new RoleNotFoundError(roleId);

    const permissionKeys = await this.securityRepository.listRolePermissionKeys(roleId);
    await this.accessControlPort.assertHasPermissionCoverageBatch(actorUserId, permissionKeys, nodeId, propagation);
  }

  private async assertTargetUserManageable(actorUserId: string, userId: string): Promise<void> {
    if (!await this.userRepository.isUserManageableBy(actorUserId, userId)) {
      throw new ForbiddenError(`User '${userId}' is outside the actor's delegated boundary.`, {
        actorUserId,
        userId,
      });
    }
  }

  private runAuthorizationMutation<T>(work: () => Promise<T>): Promise<T> {
    return this.transactionPort.runInAuthorizationMutation(work);
  }

  private async reconcileDelegatedScopes(actorUserId: string, reason: string): Promise<void> {
    const revoked = await this.securityRepository.revokeDelegatedScopeAssignmentsOutsideCoverage();
    for (const assignment of revoked) {
      await this.auditPort.record(actorUserId, 'security.revoke_delegated_scope', 'scope_assignment', assignment.id,
        assignment.nodeId, { userId: assignment.userId, roleId: assignment.roleId, assignedBy: assignment.assignedBy }, { reason });
    }
  }
}
