/** Owns security-sensitive mutations that an authenticated user performs on their own account. */
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { UnauthorizedError, ValidationError } from '../../domain/errors/ApplicationErrors.js';
import { UserPasswordSchema } from '../commands/UserAdminCommands.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { UserRepository } from '../ports/UserRepository.js';

export class CurrentAccountApplicationService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepositoryPort,
    private readonly audit: AuditPort,
    private readonly transactions: TransactionPort,
  ) {}

  async changePassword(actorUserId: string, currentPassword: string, newPassword: string): Promise<void> {
    const parsed = UserPasswordSchema.safeParse(newPassword);
    if (!parsed.success) {
      throw new ValidationError('Invalid password.', { password: parsed.error.issues.map((issue) => issue.message) });
    }
    await this.transactions.runInTransaction(async () => {
      const user = await this.users.findById(actorUserId);
      if (!user || !user.isActive || !PasswordHasher.verify(currentPassword, user.passwordHash)) {
        throw new UnauthorizedError('Current password is invalid.');
      }
      await this.users.updateUser(user.changePassword(PasswordHasher.hash(parsed.data)));
      await this.sessions.deleteSessionsForUser(user.id);
      await this.audit.record(user.id, 'user.change_own_password', 'user', user.id, null, null, { sessionsRevoked: true });
    });
  }
}
