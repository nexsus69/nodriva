/** Owns only bounded user-query page retention and authoritative page loading. */
import type { UserListPageDto, UserListPageParams } from '@dashboard/core';

export type UserPageLoader = (params: UserListPageParams) => Promise<UserListPageDto>;

/** Keeps at most twenty-four query pages; records belong to UserRecordCache, never here. */
export class UserPageCoordinator {
  private readonly pages = new Map<string, UserListPageDto>();
  public constructor(private readonly loadPage: UserPageLoader, private readonly retain: (page: UserListPageDto) => void, private readonly limit = 24) {}
  public async read(params: UserListPageParams): Promise<UserListPageDto> {
    const key = this.key(params); const cached = this.pages.get(key);
    if (cached) { this.pages.delete(key); this.pages.set(key, cached); return cached; }
    const page = await this.loadPage(params); this.retain(page); this.pages.set(key, page);
    while (this.pages.size > this.limit) this.pages.delete(this.pages.keys().next().value!);
    return page;
  }
  public invalidate(): void { this.pages.clear(); }
  private key(params: UserListPageParams): string { return JSON.stringify({ page: params.page, pageSize: params.pageSize, search: params.search?.trim() || '', sort: params.sort ?? null }); }
}
