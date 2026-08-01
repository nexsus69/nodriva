import crypto from 'crypto';
import { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import { PgExecutor } from '../../infrastructure/postgres/PgExecutor.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { UnauthorizedError } from '../../domain/errors/ApplicationErrors.js';

export class AuthApplicationService {
  constructor(
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly executor: PgExecutor // For querying users
  ) {}

  async login(email: string, plainTextPassword: string): Promise<string> {
    const res = await this.executor.query(
      `SELECT id, password_hash, is_active FROM users WHERE email = $1`,
      [email]
    );

    if (res.rows.length === 0) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const user = res.rows[0];

    if (!user || !user.is_active) {
      throw new UnauthorizedError('User is disabled');
    }

    const isValid = PasswordHasher.verify(plainTextPassword, user.password_hash as string);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate secure opaque token
    const token = crypto.randomBytes(32).toString('hex');
    // Compute SHA256 hash to store in DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // Expire in 30 minutes (allineato con maxAge JWT)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.sessionRepository.createSession(user.id as string, hashedToken, expiresAt);

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
