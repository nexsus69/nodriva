/** Owns authentication, temporary login throttling, and audited throttle administration. */
import crypto from 'crypto';
import { isIP } from 'node:net';
import type { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import type { UserRepository } from '../ports/UserRepository.js';
import type { PasswordHasherPort } from '../ports/PasswordHasherPort.js';
import { LoginRateLimitedError, UnauthorizedError, ValidationError } from '../../domain/errors/ApplicationErrors.js';
import type { LoginRateLimitPort } from '../ports/LoginRateLimitPort.js';
import type { MfaTotpApplicationService } from './MfaTotpApplicationService.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { SessionTimingPolicyPort } from '../ports/SessionTimingPolicyPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import { UserNotFoundError } from '../../domain/errors/UserAdminErrors.js';

export interface LoginRateLimitStatus {
  blockedUntil: string | null;
}

export class AuthApplicationService {
  constructor(private readonly passwords: PasswordHasherPort,
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly userRepository: UserRepository,
    private readonly sessionTiming: SessionTimingPolicyPort | number,
    private readonly loginRateLimit?: LoginRateLimitPort,
    private readonly mfa?: MfaTotpApplicationService,
    private readonly audit?: AuditPort,
    private readonly transaction?: TransactionPort,
    private readonly accessControl?: AccessControlPort,
  ) {}

  async login(
    email: string,
    plainTextPassword: string,
    sourceAddress?: string,
    mfaCode?: string,
  ): Promise<{ token: string; sessionId: string }> {
    const accountSubject = this.accountSubject(email);
    const subjects = [accountSubject];
    if (sourceAddress) subjects.push(this.sourceSubject(sourceAddress));
    const now = new Date();
    const user = await this.userRepository.findByEmail(email);
    const activeBlock = this.latestBlock(await Promise.all(subjects.map((subject) => this.loginRateLimit?.getBlockedUntil(subject, now))));
    if (activeBlock) {
      if (user) await this.audit?.record(null, 'auth.login_rate_limited', 'user', user.id, null, null, null);
      throw new LoginRateLimitedError(activeBlock);
    }
    const isValid = await this.passwords.verifyAsync(plainTextPassword, user?.passwordHash);
    if (!user || !user.isActive || !isValid) {
      const block = this.latestBlock(await Promise.all(subjects.map((subject) => this.loginRateLimit?.recordFailure(subject, now))));
      if (block) {
        if (user) await this.audit?.record(null, 'auth.login_rate_limited', 'user', user.id, null, null, null);
        throw new LoginRateLimitedError(block);
      }
      throw new UnauthorizedError('Invalid credentials');
    }

    try {
      await this.mfa?.verifyLogin(user.id, mfaCode);
    } catch (error) {
      const block = this.latestBlock(await Promise.all(subjects.map((subject) => this.loginRateLimit?.recordFailure(subject, now))));
      if (block) {
        await this.audit?.record(null, 'auth.login_rate_limited', 'user', user.id, null, null, null);
        throw new LoginRateLimitedError(block, error);
      }
      throw error;
    }

    // Generate secure opaque token
    const token = crypto.randomBytes(32).toString('hex');
    // Compute SHA256 hash to store in DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const sessionIdleTimeoutSeconds = typeof this.sessionTiming === 'number'
      ? this.sessionTiming
      : (await this.sessionTiming.getSessionTimingPolicy()).sessionIdleTimeoutSeconds;
    const expiresAt = new Date(Date.now() + sessionIdleTimeoutSeconds * 1000);

    const sessionId = await this.sessionRepository.createSession(user.id, hashedToken, expiresAt);
    await Promise.all(subjects.map((subject) => this.loginRateLimit?.clear(subject)));

    return { token, sessionId };
  }

  async resolveSession(token: string): Promise<string> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const userId = await this.sessionRepository.getSessionUserId(hashedToken);
    if (!userId) {
      throw new UnauthorizedError('Session invalid or expired');
    }
    return userId;
  }

  /** Reads the current user profile for session claims that may have changed. */
  async getUserById(userId: string) {
    return await this.userRepository.findById(userId);
  }

  async logout(token: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    await this.sessionRepository.deleteSession(hashedToken);
  }

  /** Reads the source-address block for the dedicated security administration panel. */
  async getSourceAddressRateLimitStatus(actorUserId: string, sourceAddress: string): Promise<LoginRateLimitStatus> {
    await this.assertSecurityAdministrator(actorUserId, 'system.config.read');
    const blockedUntil = await this.loginRateLimit?.getBlockedUntil(this.sourceSubject(sourceAddress), new Date()) ?? null;
    return { blockedUntil: blockedUntil?.toISOString() ?? null };
  }

  /** Releases only the account limiter; a separately administered source-address block remains in force. */
  async releaseUserLoginRateLimit(actorUserId: string, userId: string): Promise<void> {
    await this.runSecurityMutation(async () => {
      await this.assertSecurityAdministrator(actorUserId, 'user.update');
      const user = await this.userRepository.findById(userId);
      if (!user) throw new UserNotFoundError(userId);
      await this.loginRateLimit?.clear(this.accountSubject(user.email));
      await this.audit?.record(actorUserId, 'auth.login_rate_limit_released', 'user', user.id, null, null, { subject: 'account' });
    });
  }

  /** Releases only the normalized source-address limiter entered by a super-admin. */
  async releaseSourceAddressLoginRateLimit(actorUserId: string, sourceAddress: string): Promise<void> {
    const normalizedSourceAddress = this.normalizeSourceAddress(sourceAddress);
    await this.runSecurityMutation(async () => {
      await this.assertSecurityAdministrator(actorUserId, 'system.config');
      await this.loginRateLimit?.clear(this.sourceSubject(normalizedSourceAddress));
      await this.audit?.record(actorUserId, 'auth.login_rate_limit_released', 'login_rate_limit', this.hashRateLimitSubject(`source:${normalizedSourceAddress}`), null, null, { subject: 'source' });
    });
  }

  private hashRateLimitSubject(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private accountSubject(email: string): string {
    return this.hashRateLimitSubject(`account:${email.trim().toLowerCase()}`);
  }

  private sourceSubject(sourceAddress: string): string {
    return this.hashRateLimitSubject(`source:${this.normalizeSourceAddress(sourceAddress)}`);
  }

  private normalizeSourceAddress(sourceAddress: string): string {
    const normalized = sourceAddress.trim();
    if (!normalized || normalized.length > 128 || isIP(normalized) === 0) throw new ValidationError('Source address is invalid.', { sourceAddress: ['Enter a valid source address.'] });
    return normalized;
  }

  private latestBlock(blocks: Array<Date | null | undefined>): Date | null {
    return blocks.reduce<Date | null>((latest, value) => value && (!latest || value > latest) ? value : latest, null);
  }

  private async assertSecurityAdministrator(actorUserId: string, permissionKey: 'user.update' | 'system.config.read' | 'system.config'): Promise<void> {
    if (!this.accessControl) throw new Error('Login rate limit administration is not configured.');
    await this.accessControl.assertHasPermission(actorUserId, permissionKey, null);
    await this.accessControl.assertIsSuperAdmin(actorUserId);
  }

  private async runSecurityMutation(work: () => Promise<void>): Promise<void> {
    if (!this.transaction || !this.accessControl) throw new Error('Login rate limit administration is not configured.');
    await this.transaction.runInAuthorizationMutation(work);
  }
}
