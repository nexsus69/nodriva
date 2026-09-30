import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { SecurityRepository } from '../ports/SecurityRepository.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { UserRepository } from '../ports/UserRepository.js';
import type { CreateScopedUserCommand} from '../commands/ScopedUserCommands.js';
import { CreateScopedUserCommandSchema } from '../commands/ScopedUserCommands.js';
import { User } from '../../domain/models/User.js';
import type { PasswordHasherPort } from '../ports/PasswordHasherPort.js';
import { UserEmailAlreadyExistsError, UserAdminValidationError } from '../../domain/errors/UserAdminErrors.js';
import { RoleNotFoundError } from '../../domain/errors/SecurityAdminErrors.js';
import { withRequiredBaselineRole } from './UserRoleAssignmentPolicy.js';

/** Creates an identity and its first local grants atomically. */
export class ScopedUserProvisioningService {
  constructor(private readonly passwords: PasswordHasherPort,
    private readonly users: UserRepository,
    private readonly security: SecurityRepository,
    private readonly audit: AuditPort,
    private readonly transactions: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly access: AccessControlPort,
  ) {}

  async createScopedUser(command: CreateScopedUserCommand): Promise<User> {
    const parsed = CreateScopedUserCommandSchema.safeParse(command);
    if (!parsed.success) throw new UserAdminValidationError('Validation failed for scoped user creation.');
    const value = parsed.data;

    return this.transactions.runInAuthorizationMutation(async () => {
      for (const assignment of value.assignments) {
        const role = await this.security.findRoleById(assignment.roleId);
        if (!role) throw new RoleNotFoundError(assignment.roleId);
        const permissionKeys = await this.security.listRolePermissionKeys(assignment.roleId);
        await this.access.assertHasPermissionCoverageBatch(
          value.actorUserId,
          ['user.create', 'scope.assign', ...permissionKeys],
          assignment.nodeId,
          assignment.propagation,
        );
      }
      if (await this.users.findByEmail(value.email)) throw new UserEmailAlreadyExistsError(value.email);
      const user = User.create(this.ids.generate(), value.email, this.passwords.hash(value.password));
      // Default reader is inert without a scope; local access is supplied only
      // by the assignments below.
      await this.users.createUser(user, await withRequiredBaselineRole(this.users, []));
      for (const assignment of value.assignments) {
        await this.security.createScopeAssignment(
          this.ids.generate(), user.id, assignment.nodeId, assignment.roleId,
          'allow', assignment.propagation, value.actorUserId,
        );
      }
      await this.audit.record(value.actorUserId, 'user.create_scoped', 'user', user.id, null, null, {
        email: user.email,
        assignments: value.assignments,
      });
      return user;
    });
  }
}
