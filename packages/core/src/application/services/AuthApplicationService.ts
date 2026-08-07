import crypto from 'crypto';
import { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import { UserRepository } from '../ports/UserRepository.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { UnauthorizedError } from '../../domain/errors/ApplicationErrors.js';
import { LoginRateLimitPort } from '../ports/LoginRateLimitPort.js';
import { MfaTotpApplicationService } from './MfaTotpApplicationService.js';
import { AuditPort } from '../ports/AuditPort.js';
import type { SessionTimingPolicyPort } from '../ports/SessionTimingPolicyPort.js';

export class AuthApplicationService {
  constructor(
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly userRepository: UserRepository,
    private readonly sessionTiming: SessionTimingPolicyPort | number,
    private readonly loginRateLimit?: LoginRateLimitPort,
    private readonly mfa?: MfaTotpApplicationService,
    private readonly audit?: AuditPort,
  ) {}

  async login(
    email: string,
    plainTextPassword: string,
    sourceAddress?: string,
    mfaCode?: string,
  ): Promise<{ token: string; sessionId: string }> {
    const accountSubject = this.hashRateLimitSubject(`account:${email.trim().toLowerCase()}`);
    const subjects = [accountSubject];
    if (sourceAddress) subjects.push(this.hashRateLimitSubject(`source:${sourceAddress}`));
    const now = new Date();
    const user = await this.userRepository.findByEmail(email);
    try {
      await Promise.all(subjects.map((subject) => this.loginRateLimit?.assertAllowed(subject, now)));
    } catch (error) {
      if (user) await this.audit?.record(null, 'auth.login_rate_limited', 'user', user.id, null, null, null);
      throw error;
    }
    if (!user) {
      await Promise.all(subjects.map((subject) => this.loginRateLimit?.recordFailure(subject, now)));
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      await Promise.all(subjects.map((subject) => this.loginRateLimit?.recordFailure(subject, now)));
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValid = PasswordHasher.verify(plainTextPassword, user.passwordHash);
    if (!isValid) {
      await Promise.all(subjects.map((subject) => this.loginRateLimit?.recordFailure(subject, now)));
      throw new UnauthorizedError('Invalid credentials');
    }

    try {
      await this.mfa?.verifyLogin(user.id, mfaCode);
    } catch (error) {
      await Promise.all(subjects.map((subject) => this.loginRateLimit?.recordFailure(subject, now)));
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

  private hashRateLimitSubject(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
