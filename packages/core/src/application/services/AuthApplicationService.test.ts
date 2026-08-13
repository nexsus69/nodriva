import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthApplicationService } from './AuthApplicationService.js';
import type { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import type { UserRepository } from '../ports/UserRepository.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { AppError } from '../../domain/errors/AppError.js';
import { User } from '../../domain/models/User.js';
import type { LoginRateLimitPort } from '../ports/LoginRateLimitPort.js';

describe('AuthApplicationService', () => {
  let sessionRepoMock: SessionRepositoryPort;
  let userRepositoryMock: UserRepository;
  let authService: AuthApplicationService;
  let rateLimitMock: LoginRateLimitPort;

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
      listUsersManageableBy: vi.fn(),
      getUserDetailManageableBy: vi.fn(),
      isUserManageableBy: vi.fn(),
      getUserDetail: vi.fn(),
      listAllRoles: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      assignUserRoles: vi.fn(),
    };

    rateLimitMock = { assertAllowed: vi.fn(), recordFailure: vi.fn(), clear: vi.fn() };
    authService = new AuthApplicationService(sessionRepoMock, userRepositoryMock, 300, rateLimitMock);
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
