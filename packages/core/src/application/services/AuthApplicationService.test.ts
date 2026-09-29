/** Verifies authentication and the single authoritative login-throttle lifecycle. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthApplicationService } from './AuthApplicationService.js';
import type { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import type { UserRepository } from '../ports/UserRepository.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { AppError } from '../../domain/errors/AppError.js';
import { User } from '../../domain/models/User.js';
import type { LoginRateLimitPort } from '../ports/LoginRateLimitPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import { LoginRateLimitedError } from '../../domain/errors/ApplicationErrors.js';

describe('AuthApplicationService', () => {
  let sessionRepoMock: SessionRepositoryPort;
  let userRepositoryMock: UserRepository;
  let authService: AuthApplicationService;
  let rateLimitMock: LoginRateLimitPort;
  let accessControlMock: AccessControlPort;
  let transactionMock: TransactionPort;

  beforeEach(() => {
    sessionRepoMock = {
      createSession: vi.fn().mockResolvedValue('session-1'),
      getSessionUserId: vi.fn(),
      getActiveSessionExpiry: vi.fn(),
      touchSession: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      deleteSessionsForUser: vi.fn().mockResolvedValue(undefined),
    };

    userRepositoryMock = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      listUsers: vi.fn(),
      listUsersManageableBy: vi.fn(), listUsersManageablePage: vi.fn(),
      getUserDetailManageableBy: vi.fn(),
      isUserManageableBy: vi.fn(),
      getUserDetail: vi.fn(),
      listAllRoles: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      assignUserRoles: vi.fn(),
    };

    rateLimitMock = { getBlockedUntil: vi.fn().mockResolvedValue(null), recordFailure: vi.fn().mockResolvedValue(null), clear: vi.fn() };
    accessControlMock = {
      assertHasPermission: vi.fn(),
      assertIsSuperAdmin: vi.fn(),
    } as unknown as AccessControlPort;
    transactionMock = {
      runInTransaction: vi.fn((work) => work()),
      runInAuthorizationMutation: vi.fn((work) => work()),
    };
    authService = new AuthApplicationService(sessionRepoMock, userRepositoryMock, 300, rateLimitMock, undefined, undefined, transactionMock, accessControlMock);
  });

  describe('login', () => {
    it('should generate a token for valid credentials', async () => {
      const hash = PasswordHasher.hash('correct_password');
      
      vi.mocked(userRepositoryMock.findByEmail).mockResolvedValueOnce(
        new User('user-1', 'test@test.com', hash, true, false, 1, new Date(), new Date())
      );

      const result = await authService.login('test@test.com', 'correct_password');
      
      expect(result.sessionId).toBe('session-1');
      expect(typeof result.token).toBe('string');
      expect(sessionRepoMock.createSession).toHaveBeenCalledWith('user-1', expect.any(String), expect.any(Date));
      const expiresAt = vi.mocked(sessionRepoMock.createSession).mock.calls[0]?.[2];
      expect(expiresAt?.getTime()).toBeGreaterThan(Date.now() + 299_000);
      expect(expiresAt?.getTime()).toBeLessThanOrEqual(Date.now() + 300_000);
      expect(rateLimitMock.clear).toHaveBeenCalledWith(expect.any(String));
    });

    it('should throw UNAUTHORIZED if user not found', async () => {
      vi.mocked(userRepositoryMock.findByEmail).mockResolvedValueOnce(null);
      
      await expect(authService.login('test@test.com', 'pwd')).rejects.toThrow(AppError);
      expect(rateLimitMock.recordFailure).toHaveBeenCalledWith(expect.any(String), expect.any(Date));
    });

    it('should throw UNAUTHORIZED if user is disabled', async () => {
      vi.mocked(userRepositoryMock.findByEmail).mockResolvedValueOnce(
        new User('user-1', 'test@test.com', 'hash', false, false, 1, new Date(), new Date())
      );
      
      await expect(authService.login('test@test.com', 'pwd')).rejects.toThrow(AppError);
    });

    it('should throw UNAUTHORIZED for wrong password', async () => {
      const hash = PasswordHasher.hash('correct_password');
      vi.mocked(userRepositoryMock.findByEmail).mockResolvedValueOnce(
        new User('user-1', 'test@test.com', hash, true, false, 1, new Date(), new Date())
      );

      await expect(authService.login('test@test.com', 'wrong')).rejects.toThrow(AppError);
    });

    it('returns a distinct safe denial when the fifth rejected attempt activates a block', async () => {
      vi.mocked(userRepositoryMock.findByEmail).mockResolvedValueOnce(null);
      vi.mocked(rateLimitMock.recordFailure).mockResolvedValueOnce(new Date(Date.now() + 60_000));

      await expect(authService.login('test@test.com', 'wrong')).rejects.toBeInstanceOf(LoginRateLimitedError);
    });
  });

  describe('login-rate-limit administration', () => {
    it('releases an account subject in an authorized transaction and records the action', async () => {
      const user = new User('user-1', 'test@test.com', 'hash', true, false, 1, new Date(), new Date());
      vi.mocked(userRepositoryMock.findById).mockResolvedValueOnce(user);
      const audit = { record: vi.fn() };
      authService = new AuthApplicationService(sessionRepoMock, userRepositoryMock, 300, rateLimitMock, undefined, audit, transactionMock, accessControlMock);

      await authService.releaseUserLoginRateLimit('admin-1', user.id);

      expect(accessControlMock.assertHasPermission).toHaveBeenCalledWith('admin-1', 'user.update', null);
      expect(accessControlMock.assertIsSuperAdmin).toHaveBeenCalledWith('admin-1');
      expect(rateLimitMock.clear).toHaveBeenCalledWith(expect.any(String));
      expect(audit.record).toHaveBeenCalledWith('admin-1', 'auth.login_rate_limit_released', 'user', user.id, null, null, { subject: 'account' });
    });

    it('reads and releases a source address only for a security administrator', async () => {
      vi.mocked(rateLimitMock.getBlockedUntil).mockResolvedValueOnce(new Date('2026-01-01T00:15:00.000Z'));
      const audit = { record: vi.fn() };
      authService = new AuthApplicationService(sessionRepoMock, userRepositoryMock, 300, rateLimitMock, undefined, audit, transactionMock, accessControlMock);

      await expect(authService.getSourceAddressRateLimitStatus('admin-1', '203.0.113.1')).resolves.toEqual({ blockedUntil: '2026-01-01T00:15:00.000Z' });
      await authService.releaseSourceAddressLoginRateLimit('admin-1', '203.0.113.1');

      expect(accessControlMock.assertHasPermission).toHaveBeenCalledWith('admin-1', 'system.config.read', null);
      expect(accessControlMock.assertHasPermission).toHaveBeenCalledWith('admin-1', 'system.config', null);
      expect(audit.record).toHaveBeenCalledWith('admin-1', 'auth.login_rate_limit_released', 'login_rate_limit', expect.any(String), null, null, { subject: 'source' });
    });
  });

  describe('resolveSession', () => {
    it('should return userId for valid token', async () => {
      vi.mocked(sessionRepoMock.getSessionUserId).mockResolvedValueOnce('user-1');
      const userId = await authService.resolveSession('valid-token');
      expect(userId).toBe('user-1');
      expect(sessionRepoMock.touchSession).not.toHaveBeenCalled();
    });

    it('should throw error for invalid token', async () => {
      vi.mocked(sessionRepoMock.getSessionUserId).mockResolvedValueOnce(null);
      await expect(authService.resolveSession('invalid-token')).rejects.toThrow(AppError);
    });
  });

  describe('logout', () => {
    it('should delete session', async () => {
      await authService.logout('token');
      expect(sessionRepoMock.deleteSession).toHaveBeenCalledWith(expect.any(String));
    });
  });
});
