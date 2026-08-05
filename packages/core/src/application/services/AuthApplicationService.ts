import crypto from 'crypto';
import { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import { UserRepository } from '../ports/UserRepository.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { UnauthorizedError } from '../../domain/errors/ApplicationErrors.js';
import { LoginRateLimitPort } from '../ports/LoginRateLimitPort.js';

export class AuthApplicationService {
  constructor(
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly userRepository: UserRepository,
    private readonly loginRateLimit?: LoginRateLimitPort,
  ) {}

  async login(email: string, plainTextPassword: string): Promise<string> {
    const subject = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    const now = new Date();
    await this.loginRateLimit?.assertAllowed(subject, now);
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      await this.loginRateLimit?.recordFailure(subject, now);
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      await this.loginRateLimit?.recordFailure(subject, now);
      throw new UnauthorizedError('User is disabled');
    }

    const isValid = PasswordHasher.verify(plainTextPassword, user.passwordHash);
    if (!isValid) {
      await this.loginRateLimit?.recordFailure(subject, now);
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate secure opaque token
    const token = crypto.randomBytes(32).toString('hex');
    // Compute SHA256 hash to store in DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // Expire in 30 minutes (allineato con maxAge JWT)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.sessionRepository.createSession(user.id, hashedToken, expiresAt);
    await this.loginRateLimit?.clear(subject);

    return token;
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
}
