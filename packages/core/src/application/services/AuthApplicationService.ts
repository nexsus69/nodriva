import crypto from 'crypto';
import { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import { UserRepository } from '../ports/UserRepository.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { UnauthorizedError } from '../../domain/errors/ApplicationErrors.js';

export class AuthApplicationService {
  constructor(
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly userRepository: UserRepository
  ) {}

  async login(email: string, plainTextPassword: string): Promise<string> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User is disabled');
    }

    const isValid = PasswordHasher.verify(plainTextPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate secure opaque token
    const token = crypto.randomBytes(32).toString('hex');
    // Compute SHA256 hash to store in DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // Expire in 30 minutes (allineato con maxAge JWT)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.sessionRepository.createSession(user.id, hashedToken, expiresAt);

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

  async logout(token: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    await this.sessionRepository.deleteSession(hashedToken);
  }
}
