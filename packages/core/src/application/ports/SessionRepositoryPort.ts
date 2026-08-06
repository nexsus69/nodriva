export interface SessionRepositoryPort {
  createSession(userId: string, token: string, expiresAt: Date): Promise<string>;
  getSessionUserId(token: string): Promise<string | null>;
  getActiveSessionExpiry(sessionId: string, userId: string): Promise<Date | null>;
  touchSession(sessionId: string, userId: string, expiresAt: Date): Promise<boolean>;
  deleteSession(token: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
}
