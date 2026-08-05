import crypto from 'crypto';
import { AccountActionPurpose, AccountActionTokenPort } from '../ports/AccountActionTokenPort.js';
import { AccessControlPort } from '../ports/AccessControlPort.js';
import { AuditPort } from '../ports/AuditPort.js';
import { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import { TransactionPort } from '../ports/TransactionPort.js';
import { UserRepository } from '../ports/UserRepository.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { UnauthorizedError } from '../../domain/errors/ApplicationErrors.js';
import { User } from '../../domain/models/User.js';

export class AccountRecoveryApplicationService {
  constructor(private readonly tokens: AccountActionTokenPort, private readonly users: UserRepository,
    private readonly sessions: SessionRepositoryPort, private readonly audit: AuditPort,
    private readonly transactions: TransactionPort, private readonly access: AccessControlPort) {}

  async issue(actorUserId: string, userId: string, purpose: AccountActionPurpose): Promise<{ token: string; expiresAt: Date }> {
    await this.access.assertIsSuperAdmin(actorUserId);
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.tokens.create({ userId, purpose, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt, createdBy: actorUserId });
    await this.audit.record(actorUserId, `user.${purpose}_issued`, 'user', userId, null, null, { expiresAt: expiresAt.toISOString() });
    return { token, expiresAt };
  }

  async complete(token: string, password: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await this.transactions.runInTransaction(async () => {
      const action = await this.tokens.consume(tokenHash, new Date());
      if (!action) throw new UnauthorizedError('Invalid or expired account action');
      const user = await this.users.findById(action.userId);
      if (!user) throw new UnauthorizedError('Invalid or expired account action');
      const updated = new User(user.id, user.email, PasswordHasher.hash(password), true, user.isSuperAdmin,
        user.rowVersion + 1, user.createdAt, new Date(), user.deletedAt);
      await this.users.updateUser(updated);
      await this.sessions.deleteSessionsForUser(user.id);
      await this.audit.record(null, `user.${action.purpose}_completed`, 'user', user.id, null, null, null);
    });
  }
}
