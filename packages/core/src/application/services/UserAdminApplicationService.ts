/** Orchestrates user lifecycle operations within the actor's manageable scopes. */
import type { UserRepository } from '../ports/UserRepository.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import { User } from '../../domain/models/User.js';
import type { UserListItemDto, UserDetailDto } from '../dto/UserAdminDtos.js';
import type {
  CreateUserCommand,
  UpdateUserStatusCommand,
  AssignUserRolesCommand,
  UpdateUserCommand,
  ResetUserPasswordCommand} from '../commands/UserAdminCommands.js';
import { CreateUserCommandSchema, UpdateUserStatusCommandSchema, AssignUserRolesCommandSchema, UpdateUserCommandSchema, ResetUserPasswordCommandSchema,
} from '../commands/UserAdminCommands.js';
import {
  UserNotFoundError,
  UserEmailAlreadyExistsError,
  UserAdminValidationError,
} from '../../domain/errors/UserAdminErrors.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { ForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import type { z } from 'zod';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import type { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import type { SecurityRepository } from '../ports/SecurityRepository.js';
import type { MfaTotpPort } from '../ports/MfaTotpPort.js';

export class UserAdminApplicationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly auditPort: AuditPort,
    private readonly transactionPort: TransactionPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly accessControlPort: AccessControlPort,
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly scopeDelegationLifecycle?: Pick<SecurityRepository, 'revokeDelegatedScopeAssignmentsOutsideCoverage'>,
    private readonly mfa?: MfaTotpPort,
  ) {}

  async listUsers(actorUserId: string): Promise<UserListItemDto[]> {
    return await this.userRepository.listUsersManageableBy(actorUserId);
  }

  async getUserById(actorUserId: string, id: string): Promise<UserDetailDto | null> {
    return await this.userRepository.getUserDetailManageableBy(actorUserId, id);
  }

  async createUser(cmd: CreateUserCommand): Promise<User> {
    const v = this.validateCommand(CreateUserCommandSchema, cmd, 'creating user');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'user.create', null);
    // This legacy path is reserved for the exceptional superadmin identity.
    // Every ordinary identity must be created with its first scoped grant by
    // ScopedUserProvisioningService, so no active user can lack a perimeter.
    await this.assertActorIsSuperAdmin(v.actorUserId, 'create users');
    if (!v.isSuperAdmin) {
      throw new ForbiddenError('Ordinary users must be created together with at least one role scope.', {
        actorUserId: v.actorUserId,
      });
    }

    // user_roles grants global administrative capabilities. Local data access
    // must instead be granted through node_scope_assignments, where delegation
    // is checked against the actor's effective permissions.
    if ((v.roleIds?.length ?? 0) > 0) {
      await this.accessControlPort.assertHasPermission(v.actorUserId, 'user.assign_roles', null);
      await this.assertActorIsSuperAdmin(v.actorUserId, 'assign global roles while creating a user');
    }

    return await this.transactionPort.runInTransaction(async () => {
      const existing = await this.userRepository.findByEmail(v.email);
      if (existing) {
        throw new UserEmailAlreadyExistsError(v.email);
      }

      if (v.isSuperAdmin) {
        const actor = await this.userRepository.findById(v.actorUserId);
        if (!actor?.isSuperAdmin) {
          throw new ForbiddenError("Only Super Admins can grant Super Admin privileges.", { actorUserId: v.actorUserId });
        }
      }

      const userId = this.idGenerator.generate();
      const user = User.create(
        userId,
        v.email,
        PasswordHasher.hash(v.password),
        v.isSuperAdmin ?? false
      );

      await this.userRepository.createUser(user, v.roleIds ?? []);
      await this.auditPort.record(
        v.actorUserId,
        'user.create',
        'user',
        user.id,
        null,
        null,
        { email: user.email, isSuperAdmin: user.isSuperAdmin, roleIds: v.roleIds ?? [] }
      );

      return user;
    });
  }

  async updateUserStatus(cmd: UpdateUserStatusCommand): Promise<User> {
    const v = this.validateCommand(UpdateUserStatusCommandSchema, cmd, 'updating user status');
    if (!v.isActive && v.userId === v.actorUserId) {
      throw new UserAdminValidationError('You cannot disable the account used for the current session.', {
        userId: ['Sign in with another administrator to disable this account.'],
      });
    }
    await this.assertUserManageable(v.actorUserId, v.userId, 'change user status');

    return await this.transactionPort.runInTransaction(async () => {
      const user = await this.userRepository.findById(v.userId);
      if (!user) {
        throw new UserNotFoundError(v.userId);
      }

      const actor = await this.userRepository.findById(v.actorUserId);
      const isActorSuperAdmin = actor?.isSuperAdmin ?? false;

      if (user.isSuperAdmin && !isActorSuperAdmin) {
        throw new ForbiddenError("Only Super Admins can change the status of a Super Admin.", { actorUserId: v.actorUserId });
      }

      if (user.rowVersion !== v.expectedRowVersion) {
        throw new RowVersionMismatchError(v.expectedRowVersion, user.rowVersion);
      }

      const updated = v.isActive ? user.activate() : user.disable();

      await this.userRepository.updateUser(updated);
      if (!updated.isActive) {
        await this.sessionRepository.deleteSessionsForUser(updated.id);
        const revoked = await this.scopeDelegationLifecycle?.revokeDelegatedScopeAssignmentsOutsideCoverage() ?? [];
        for (const assignment of revoked) {
          await this.auditPort.record(v.actorUserId, 'security.revoke_delegated_scope', 'scope_assignment', assignment.id,
            assignment.nodeId, { userId: assignment.userId, roleId: assignment.roleId, assignedBy: assignment.assignedBy },
            { reason: 'delegator disabled' });
        }
      }
      await this.auditPort.record(
        v.actorUserId,
        'user.update_status',
        'user',
        user.id,
        null,
        { isActive: user.isActive },
        { isActive: updated.isActive }
      );

      return updated;
    });
  }

  async updateUser(cmd: UpdateUserCommand): Promise<User> {
    const v = this.validateCommand(UpdateUserCommandSchema, cmd, 'updating user details');
    await this.assertUserManageable(v.actorUserId, v.userId, 'modify user identities');

    return await this.transactionPort.runInTransaction(async () => {
      const user = await this.userRepository.findById(v.userId);
      if (!user) {
        throw new UserNotFoundError(v.userId);
      }

      const actor = await this.userRepository.findById(v.actorUserId);
      const isActorSuperAdmin = actor?.isSuperAdmin ?? false;

      if (user.isSuperAdmin && !isActorSuperAdmin) {
        throw new ForbiddenError("Only Super Admins can modify a Super Admin.", { actorUserId: v.actorUserId });
      }

      if (v.isSuperAdmin && !isActorSuperAdmin) {
        throw new ForbiddenError("Only Super Admins can grant Super Admin privileges.", { actorUserId: v.actorUserId });
      }

      if (user.rowVersion !== v.expectedRowVersion) {
        throw new RowVersionMismatchError(v.expectedRowVersion, user.rowVersion);
      }

      const existingByEmail = await this.userRepository.findByEmail(v.email);
      if (existingByEmail && existingByEmail.id !== v.userId) {
        throw new UserEmailAlreadyExistsError(v.email);
      }

      const updated = new User(
        user.id,
        v.email.toLowerCase().trim(),
        user.passwordHash,
        user.isActive,
        v.isSuperAdmin,
        user.rowVersion + 1,
        user.createdAt,
        new Date(),
        user.deletedAt
      );

      await this.userRepository.updateUser(updated);
      await this.auditPort.record(
        v.actorUserId,
        'user.update',
        'user',
        user.id,
        null,
        { email: user.email, isSuperAdmin: user.isSuperAdmin },
        { email: updated.email, isSuperAdmin: updated.isSuperAdmin }
      );

      return updated;
    });
  }

  async assignUserRoles(cmd: AssignUserRolesCommand): Promise<void> {
    const v = this.validateCommand(AssignUserRolesCommandSchema, cmd, 'assigning user roles');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'user.assign_roles', null);
    await this.assertActorIsSuperAdmin(v.actorUserId, 'assign global roles');

    return await this.transactionPort.runInTransaction(async () => {
      const user = await this.userRepository.findById(v.userId);
      if (!user) {
        throw new UserNotFoundError(v.userId);
      }

      const actor = await this.userRepository.findById(v.actorUserId);
      const isActorSuperAdmin = actor?.isSuperAdmin ?? false;

      if (user.isSuperAdmin && !isActorSuperAdmin) {
        throw new ForbiddenError("Only Super Admins can assign roles to a Super Admin.", { actorUserId: v.actorUserId });
      }

      if (user.rowVersion !== v.expectedRowVersion) {
        throw new RowVersionMismatchError(v.expectedRowVersion, user.rowVersion);
      }

      const updated = new User(
        user.id,
        user.email,
        user.passwordHash,
        user.isActive,
        user.isSuperAdmin,
        user.rowVersion + 1,
        user.createdAt,
        new Date(),
        user.deletedAt
      );

      await this.userRepository.updateUser(updated);
      await this.userRepository.assignUserRoles(v.userId, v.roleIds);
      await this.auditPort.record(
        v.actorUserId,
        'user.assign_roles',
        'user',
        user.id,
        null,
        null,
        { roleIds: v.roleIds }
      );
    });
  }

  private async assertUserManageable(actorUserId: string, userId: string, action: string): Promise<void> {
    if (!await this.userRepository.isUserManageableBy(actorUserId, userId)) {
      throw new ForbiddenError(`User '${userId}' is outside the actor's delegated boundary; cannot ${action}.`, {
        actorUserId,
        userId,
      });
    }
  }

  async resetUserPassword(cmd: ResetUserPasswordCommand): Promise<User> {
    const v = this.validateCommand(ResetUserPasswordCommandSchema, cmd, 'resetting user password');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'user.update', null);
    await this.assertActorIsSuperAdmin(v.actorUserId, 'reset user passwords');

    return await this.transactionPort.runInTransaction(async () => {
      const user = await this.userRepository.findById(v.userId);
      if (!user) {
        throw new UserNotFoundError(v.userId);
      }

      const actor = await this.userRepository.findById(v.actorUserId);
      if (user.isSuperAdmin && !actor?.isSuperAdmin) {
        throw new ForbiddenError('Only Super Admins can reset a Super Admin password.', {
          actorUserId: v.actorUserId,
          userId: v.userId,
        });
      }

      if (user.rowVersion !== v.expectedRowVersion) {
        throw new RowVersionMismatchError(v.expectedRowVersion, user.rowVersion);
      }

      const updated = user.changePassword(PasswordHasher.hash(v.newPassword));
      await this.userRepository.updateUser(updated);
      await this.sessionRepository.deleteSessionsForUser(user.id);
      await this.mfa?.deleteForUser(user.id);
      await this.auditPort.record(
        v.actorUserId,
        'user.reset_password',
        'user',
        user.id,
        null,
        null,
        { sessionsRevoked: true, mfaRevoked: Boolean(this.mfa) }
      );
      return updated;
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
      throw new UserAdminValidationError(`Validation failed for ${actionName}.`, issues);
    }
    return res.data;
  }

  private async assertActorIsSuperAdmin(actorUserId: string, action: string): Promise<void> {
    const actor = await this.userRepository.findById(actorUserId);
    if (!actor?.isSuperAdmin || !actor.isActive) {
      throw new ForbiddenError(`Only Super Admins can ${action}.`, { actorUserId });
    }
  }
}
