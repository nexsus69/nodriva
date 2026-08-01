import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthApplicationService } from './AuthApplicationService.js';
import { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import { PgExecutor } from '../../infrastructure/postgres/PgExecutor.js';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { AppError } from '../../domain/errors/AppError.js';

describe('AuthApplicationService', () => {
  let sessionRepoMock: SessionRepositoryPort;
  let executorMock: PgExecutor;
  let authService: AuthApplicationService;

  beforeEach(() => {
    sessionRepoMock = {
      createSession: vi.fn().mockResolvedValue(undefined),
      getSessionUserId: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      deleteSessionsForUser: vi.fn().mockResolvedValue(undefined),
    };

    executorMock = {
      query: vi.fn(),
    } as unknown as PgExecutor;

    authService = new AuthApplicationService(sessionRepoMock, executorMock);
  });

  describe('login', () => {
    it('should generate a token for valid credentials', async () => {
      const hash = PasswordHasher.hash('correct_password');
      
      vi.mocked(executorMock.query).mockResolvedValueOnce({
        rows: [{ id: 'user-1', password_hash: hash, is_active: true }]
      } as any);

      const token = await authService.login('test@test.com', 'correct_password');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(sessionRepoMock.createSession).toHaveBeenCalledWith('user-1', expect.any(String), expect.any(Date));
    });

    it('should throw UNAUTHORIZED if user not found', async () => {
      vi.mocked(executorMock.query).mockResolvedValueOnce({ rows: [] } as any);
      
      await expect(authService.login('test@test.com', 'pwd')).rejects.toThrow(AppError);
    });

    it('should throw UNAUTHORIZED if user is disabled', async () => {
      vi.mocked(executorMock.query).mockResolvedValueOnce({
        rows: [{ id: 'user-1', password_hash: 'hash', is_active: false }]
      } as any);
      
      await expect(authService.login('test@test.com', 'pwd')).rejects.toThrow(AppError);
    });

    it('should throw UNAUTHORIZED for wrong password', async () => {
      const hash = PasswordHasher.hash('correct_password');
      vi.mocked(executorMock.query).mockResolvedValueOnce({
        rows: [{ id: 'user-1', password_hash: hash, is_active: true }]
      } as any);

      await expect(authService.login('test@test.com', 'wrong')).rejects.toThrow(AppError);
    });
  });

  describe('resolveSession', () => {
    it('should return userId for valid token', async () => {
      vi.mocked(sessionRepoMock.getSessionUserId).mockResolvedValueOnce('user-1');
      const userId = await authService.resolveSession('valid-token');
      expect(userId).toBe('user-1');
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
