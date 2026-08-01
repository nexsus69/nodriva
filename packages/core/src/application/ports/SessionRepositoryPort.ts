export interface SessionRepositoryPort {
  createSession(userId: string, token: string, expiresAt: Date): Promise<void>;
  getSessionUserId(token: string): Promise<string | null>;
  deleteSession(token: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
}
