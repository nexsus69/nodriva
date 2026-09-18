/** Covers bounded audit page caching and conservative invalidation from generic audit events. */
import { describe, expect, it, vi } from 'vitest';
import type { AuditLogListItemDto, PaginatedResultDto } from '@dashboard/core';
import { CacheKernel } from './CacheKernel';
import { AdminAuditPageCoordinator } from './AdminAuditPageCoordinator';

const item = (id: string): AuditLogListItemDto => ({ id, actorUserId: 'user-1', actorEmail: 'operator@example.test', actionKey: 'entity.update', resourceKind: 'entity', resourceId: 'entity-1', nodeId: 'node-1', createdAt: '2026-01-01T00:00:00.000Z' });
const page = (id: string, number: number): PaginatedResultDto<AuditLogListItemDto> => ({ items: [item(id)], total: 10, page: number, pageSize: 25, totalPages: 10 });

describe('AdminAuditPageCoordinator', () => {
  it('reuses a continuous cached page and retains only five windows', async () => {
    const load = vi.fn(async (filters: { page?: number }) => page(`audit-${filters.page}`, filters.page ?? 1));
    const kernel = new CacheKernel();
    const coordinator = new AdminAuditPageCoordinator(kernel, load, async () => true);

    await coordinator.read({ page: 1, pageSize: 25 });
    await coordinator.read({ page: 2, pageSize: 25 });
    await coordinator.read({ page: 1, pageSize: 25 });
    expect(load).toHaveBeenCalledTimes(2);

    for (let number = 3; number <= 6; number += 1) await coordinator.read({ page: number, pageSize: 25 });
    expect(kernel.getRecord('admin-audit', 'audit-2')).toBeNull();
    expect(kernel.getRecord('admin-audit', 'audit-1')).toEqual(item('audit-1'));
  });

  it('reloads only the audit query family after a generic realtime audit invalidation', async () => {
    const load = vi.fn(async (filters: { page?: number }) => page(`audit-${filters.page}`, filters.page ?? 1));
    const coordinator = new AdminAuditPageCoordinator(new CacheKernel(), load, async () => true);
    await coordinator.read({ page: 1, pageSize: 25 });
    await coordinator.read({ page: 2, pageSize: 25 });

    coordinator.invalidateFamily();
    await coordinator.read({ page: 1, pageSize: 25 });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('does not reuse a page when continuity cannot be verified', async () => {
    const load = vi.fn(async () => page('audit-1', 1));
    const coordinator = new AdminAuditPageCoordinator(new CacheKernel(), load, async () => false);
    await coordinator.read({ page: 1, pageSize: 25 });
    await coordinator.read({ page: 1, pageSize: 25 });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
