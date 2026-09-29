/** Owns canonical user records and user mutations while delegating page retention to UserPageCoordinator. */
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
  UserListPageDto,
  UserListPageParams,
} from '@dashboard/core';
import {
  assignUserRolesAction,
  createUserAction,
  createScopedUserAction,
  getUserByIdAction,
  listUsersAction,
  listUsersPageAction,
  resetUserPasswordAction,
  releaseUserLoginRateLimitAction,
  updateUserAction,
  updateUserStatusAction,
} from '../actions/userActions';
import type { CacheKernel } from './CacheKernel';
import { UserPageCoordinator } from './UserPageCoordinator';

type CachedUser = UserDetailDto;

class UserRecordCache {
  public constructor(
    private readonly kernel: CacheKernel,
    private readonly onChange: () => void,
  ) {}

  public get(id: string): CachedUser | null {
    return this.kernel.getRecord<CachedUser>('user', id);
  }

  public subscribe(id: string, callback: (user: CachedUser | null, error: Error | null) => void): () => void {
    return this.kernel.subscribeRecord('user', id, (record) => callback(record as CachedUser | null, null));
  }

  public async fetchIfMissing(id: string, requireComplete: boolean, fetcher: (id: string) => Promise<CachedUser>): Promise<CachedUser | null> {
    const current = this.get(id);
    if (current && (!requireComplete || this.kernel.getRecordSatisfaction('user', id, 'full') === 'satisfied')) return current;
    const result = await fetcher(id);
    this.inject(result.id, result, false, 'fetch:user-detail');
    return result;
  }

  public inject(id: string, data: Partial<CachedUser> & { id: string }, partial: boolean, source: string): void {
    void source;
    this.kernel.upsertRecord('user', data as CachedUser, { completeness: partial ? 'summary' : 'full' });
    this.onChange();
  }

  public purge(): void {
    this.kernel.purgeNamespace('user');
    this.onChange();
  }
}

function actionError(error: ApiErrorResponse): Error & ApiErrorResponse {
  return Object.assign(new Error(error.message), error);
}

export class UserCacheClient {
  private readonly entities: UserRecordCache;
  private listIds: string[] = [];
  private listUpdatedAt = 0;
  private listLoading = false;
  private listError: Error | null = null;
  private readonly listSubscribers = new Set<() => void>();
  private readonly pages: UserPageCoordinator;
  private sessionRefresh: ((userId: string) => Promise<void>) | null = null;

  constructor(kernel: CacheKernel, private readonly onChange: () => void) {
    this.entities = new UserRecordCache(kernel, onChange);
    this.fetchUser = async (id) => {
        const result = await getUserByIdAction(id);
        if (!result.success || !result.data) {
          throw actionError(result.error ?? { code: 'NOT_FOUND', message: 'Utente non trovato.' });
        }
        return result.data;
      };
    this.pages = new UserPageCoordinator(async (params) => {
      const result = await listUsersPageAction(params);
      if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile caricare gli utenti.' });
      return result.data;
    }, (page) => this.retainPage(page));
  }

  private readonly fetchUser: (id: string) => Promise<CachedUser>;

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
    const user = await this.entities.fetchIfMissing(id, true, this.fetchUser);
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

  /** Returns a bounded cached page. Map reinsertion keeps the least-recently-used page at the front. */
  public async listUsersPage(params: UserListPageParams): Promise<UserListPageDto> {
    return this.pages.read(params);
  }

  private retainPage(page: UserListPageDto): void {
    for (const user of page.items) {
      const current = this.entities.get(user.id);
      this.entities.inject(user.id, { ...(current ?? {}), ...user, roles: current?.roles ?? [] } as CachedUser, true, 'fetch:user-page');
    }
  }

  public invalidatePages(): void {
    this.pages.invalidate();
    this.listSubscribers.forEach((subscriber) => subscriber());
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
    this.invalidatePages();
    return result.data;
  }

  public async createScopedUser(command: Omit<CreateScopedUserCommand, 'actorUserId'>): Promise<{ id: string; email: string }> {
    const result = await createScopedUserAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile creare l’utente con scope.' });
    this.invalidatePages();
    return result.data;
  }

  public async updateUser(command: UpdateUserUiCommand): Promise<UserDetailDto> {
    const result = await updateUserAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile aggiornare l’utente.' });
    this.entities.inject(result.data.id, result.data, false, 'mutation:user-update');
    await this.refreshCurrentSession(result.data.id);
    this.invalidatePages();
    return result.data;
  }

  public async updateUserStatus(command: UpdateUserStatusUiCommand): Promise<UserDetailDto> {
    const result = await updateUserStatusAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile aggiornare lo stato.' });
    this.entities.inject(result.data.id, result.data, false, 'mutation:user-status');
    await this.refreshCurrentSession(result.data.id);
    this.invalidatePages();
    return result.data;
  }

  public async assignUserRoles(command: AssignUserRolesUiCommand): Promise<UserDetailDto> {
    const result = await assignUserRolesAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile aggiornare i ruoli.' });
    this.entities.inject(result.data.id, result.data, false, 'mutation:user-roles');
    await this.refreshCurrentSession(result.data.id);
    this.invalidatePages();
    return result.data;
  }

  public async resetUserPassword(command: ResetUserPasswordUiCommand): Promise<UserDetailDto> {
    const result = await resetUserPasswordAction(command);
    if (!result.success || !result.data) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile reimpostare la password.' });
    this.entities.inject(result.data.id, result.data, false, 'mutation:user-password');
    await this.refreshCurrentSession(result.data.id);
    this.invalidatePages();
    return result.data;
  }

  public async releaseLoginRateLimit(userId: string): Promise<void> {
    const result = await releaseUserLoginRateLimitAction(userId);
    if (!result.success) throw actionError(result.error ?? { code: 'INTERNAL_ERROR', message: 'Impossibile rilasciare il blocco di accesso.' });
  }

  public purge(): void {
    this.entities.purge();
    this.listIds = [];
    this.listUpdatedAt = 0;
    this.listError = null;
    this.pages.invalidate();
    this.listSubscribers.forEach((subscriber) => subscriber());
  }

  private async refreshCurrentSession(userId: string): Promise<void> {
    if (this.sessionRefresh) await this.sessionRefresh(userId);
  }

}
