import type {
  ApiErrorResponse,
  AssignUserRolesUiCommand,
  CreateUserUiCommand,
  CreateScopedUserCommand,
  ResetUserPasswordUiCommand,
  UpdateUserStatusUiCommand,
  UpdateUserUiCommand,
  UserDetailDto,
  UserListItemDto,
} from '@dashboard/core';
import {
  assignUserRolesAction,
  createUserAction,
  createScopedUserAction,
  getUserByIdAction,
  listUsersAction,
  resetUserPasswordAction,
  updateUserAction,
  updateUserStatusAction,
} from '../actions/userActions';
import { DomainCacheClient } from './DomainCacheClient';

type CachedUser = UserDetailDto;

function actionError(error: ApiErrorResponse): Error & ApiErrorResponse {
  return Object.assign(new Error(error.message), error);
}

export class UserCacheClient {
  private readonly entities: DomainCacheClient<CachedUser>;
  private listIds: string[] = [];
  private listUpdatedAt = 0;
  private listLoading = false;
  private listError: Error | null = null;
  private readonly listSubscribers = new Set<() => void>();
  private sessionRefresh: ((userId: string) => Promise<void>) | null = null;

  constructor(private readonly onChange: () => void) {
    this.entities = new DomainCacheClient<CachedUser>(
      'users',
      async (id) => {
        const result = await getUserByIdAction(id);
        if (!result.success || !result.data) {
          throw actionError(result.error ?? { code: 'NOT_FOUND', message: 'Utente non trovato.' });
        }
        return result.data;
      },
      onChange
    );
  }

  public bindSessionRefresh(refresh: (userId: string) => Promise<void>): () => void {
    this.sessionRefresh = refresh;
    return () => {
      if (this.sessionRefresh === refresh) this.sessionRefresh = null;
    };
  }

  public get(id: string): CachedUser | null {
    return this.entities.get(id);
  }

  public subscribe(id: string, callback: (user: CachedUser | null, error: Error | null) => void): () => void {
    return this.entities.subscribe(id, callback);
  }

  public async getUser(id: string): Promise<CachedUser> {
    const user = await this.entities.fetchIfMissing(id, true);
    if (!user) throw new Error(`Utente ${id} non trovato.`);
    return user;
  }

  public async listUsers(): Promise<UserListItemDto[]> {
    this.listLoading = true;
    this.listError = null;
    this.listSubscribers.forEach((subscriber) => subscriber());
    try {
      const result = await listUsersAction();
      if (!result.success || !result.data) {
        throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile caricare gli utenti.' });
      }
      this.listIds = result.data.map((user) => user.id);
      this.listUpdatedAt = Date.now();
      for (const user of result.data) {
        const current = this.entities.get(user.id);
        this.entities.inject(
          user.id,
          { ...(current ?? {}), ...user, roles: current?.roles ?? [] } as CachedUser,
          true,
          'fetch:user-list'
        );
      }
      return result.data;
    } catch (error) {
      this.listError = error instanceof Error ? error : new Error(String(error));
      throw error;
    } finally {
      this.listLoading = false;
      this.listSubscribers.forEach((subscriber) => subscriber());
    }
  }

  public getListSnapshot(): { ids: string[]; updatedAt: number; loading: boolean; error: Error | null } {
    return { ids: [...this.listIds], updatedAt: this.listUpdatedAt, loading: this.listLoading, error: this.listError };
  }

  public subscribeList(callback: () => void): () => void {
    this.listSubscribers.add(callback);
    return () => this.listSubscribers.delete(callback);
  }

  public async createUser(command: CreateUserUiCommand): Promise<UserDetailDto> {
    const result = await createUserAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile creare l’utente.' });
    this.entities.inject(result.data.id, result.data, false, 'mutation:user-create');
    await this.listUsers();
    return result.data;
  }

  public async createScopedUser(command: Omit<CreateScopedUserCommand, 'actorUserId'>): Promise<{ id: string; email: string }> {
    const result = await createScopedUserAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile creare l’utente con scope.' });
    await this.listUsers();
    return result.data;
  }

  public async updateUser(command: UpdateUserUiCommand): Promise<UserDetailDto> {
    const result = await updateUserAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile aggiornare l’utente.' });
    this.entities.inject(result.data.id, result.data, false, 'mutation:user-update');
    await this.refreshCurrentSession(result.data.id);
    await this.listUsers();
    return result.data;
  }

  public async updateUserStatus(command: UpdateUserStatusUiCommand): Promise<UserDetailDto> {
    const result = await updateUserStatusAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile aggiornare lo stato.' });
    this.entities.inject(result.data.id, result.data, false, 'mutation:user-status');
    await this.refreshCurrentSession(result.data.id);
    await this.listUsers();
    return result.data;
  }

  public async assignUserRoles(command: AssignUserRolesUiCommand): Promise<UserDetailDto> {
    const result = await assignUserRolesAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile aggiornare i ruoli.' });
    this.entities.inject(result.data.id, result.data, false, 'mutation:user-roles');
    await this.refreshCurrentSession(result.data.id);
    return result.data;
  }

  public async resetUserPassword(command: ResetUserPasswordUiCommand): Promise<UserDetailDto> {
    const result = await resetUserPasswordAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile reimpostare la password.' });
    this.entities.inject(result.data.id, result.data, false, 'mutation:user-password');
    await this.refreshCurrentSession(result.data.id);
    return result.data;
  }

  public purge(): void {
    this.entities.purge();
    this.listIds = [];
    this.listUpdatedAt = 0;
    this.listError = null;
    this.listSubscribers.forEach((subscriber) => subscriber());
  }

  private async refreshCurrentSession(userId: string): Promise<void> {
    if (this.sessionRefresh) await this.sessionRefresh(userId);
  }
}
