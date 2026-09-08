/** Owns atomic issuance and completion of account recovery actions. */
import crypto from 'crypto';
import type { AccountActionPurpose, AccountActionTokenPort } from '../ports/AccountActionTokenPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { UserRepository } from '../ports/UserRepository.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { UnauthorizedError } from '../../domain/errors/ApplicationErrors.js';
import { User } from '../../domain/models/User.js';
import { UserPasswordSchema } from '../commands/UserAdminCommands.js';
import type { MfaTotpPort } from '../ports/MfaTotpPort.js';
import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import type { AccountActionDeliveryPort } from '../ports/AccountActionDeliveryPort.js';
import type { AccountActionDeliveryOutboxPort } from '../ports/AccountActionDeliveryOutboxPort.js';
import type { AccountActionTokenCipherPort } from '../ports/AccountActionTokenCipherPort.js';
import type { AccountActionDeliveryDrainer } from './AccountActionDeliveryDrainer.js';

export class AccountRecoveryApplicationService {
  constructor(private readonly tokens: AccountActionTokenPort, private readonly users: UserRepository,
    private readonly sessions: SessionRepositoryPort, private readonly audit: AuditPort,
    private readonly transactions: TransactionPort, private readonly access: AccessControlPort,
    private readonly mfa?: MfaTotpPort, private readonly delivery?: AccountActionDeliveryPort,
    private readonly outbox?: AccountActionDeliveryOutboxPort, private readonly cipher?: AccountActionTokenCipherPort,
    private readonly drainer?: AccountActionDeliveryDrainer) {}

  async issue(actorUserId: string, userId: string, purpose: AccountActionPurpose): Promise<{ token: string; expiresAt: Date }> {
    await this.access.assertIsSuperAdmin(actorUserId);
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');
    if (!this.delivery || !this.outbox || !this.cipher || !this.drainer) throw new Error('Account action delivery is not configured.');
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const deliveryId = crypto.randomUUID();
    await this.transactions.runInTransaction(async () => {
      await this.tokens.create({ userId, purpose, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt, createdBy: actorUserId });
      await this.outbox!.enqueue({ id: deliveryId, email: user.email, purpose, tokenCiphertext: this.cipher!.encrypt(token), expiresAt });
      await this.audit.record(actorUserId, `user.${purpose}_issued`, 'user', userId, null, null, { expiresAt: expiresAt.toISOString(), deliveryId });
      this.transactions.afterCommit?.(async () => {
        await this.drainer!.drain().catch((error: unknown) => {
        console.error('[AccountRecovery] Account action outbox drain failed:', error);
        });
      });
    });
    return { token, expiresAt };
  }

  async complete(token: string, password: string): Promise<void> {
    const parsedPassword = UserPasswordSchema.safeParse(password);
    if (!parsedPassword.success) {
      throw new ValidationError('Invalid password.', {
        password: parsedPassword.error.issues.map((issue) => issue.message),
      });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await this.transactions.runInTransaction(async () => {
      const action = await this.tokens.consume(tokenHash, new Date());
      if (!action) throw new UnauthorizedError('Invalid or expired account action');
      const user = await this.users.findById(action.userId);
      if (!user) throw new UnauthorizedError('Invalid or expired account action');
      const updated = new User(user.id, user.email, PasswordHasher.hash(parsedPassword.data), true, user.isSuperAdmin,
        user.rowVersion + 1, user.createdAt, new Date(), user.deletedAt);
      await this.users.updateUser(updated);
      await this.sessions.deleteSessionsForUser(user.id);
      await this.mfa?.deleteForUser(user.id);
      await this.audit.record(null, `user.${action.purpose}_completed`, 'user', user.id, null, null, null);
    });
  }
}
