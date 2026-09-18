/** Covers bounded type catalogue page-window coordination. */
import { describe, expect, it, vi } from 'vitest';
import type { TypeListItemDto } from '@dashboard/core';
import { CacheKernel } from './CacheKernel';
import { AdminTypePageCoordinator } from './AdminTypePageCoordinator';

const item = (patch: Partial<TypeListItemDto> = {}): TypeListItemDto => ({
  id: 'type-1', kind: 'node', typeKey: 'project', name: 'Project', description: '', storageTable: null,
  currentSchemaVersion: 1, isActive: true, isSystem: false, rowVersion: 1, fieldCount: 2, updatedAt: '2026-01-01T00:00:00.000Z', ...patch,
});

describe('AdminTypePageCoordinator', () => {
  it('reuses a retained page only after continuity verification', async () => {
    const loadPage = vi.fn().mockResolvedValue({ items: [item()], total: 1, page: 1, pageCount: 1 });
    const coordinator = new AdminTypePageCoordinator(new CacheKernel(), loadPage, vi.fn(), vi.fn().mockResolvedValue(true));
    await coordinator.read('node', { page: 1, pageSize: 25 });
    await coordinator.read('node', { page: 1, pageSize: 25 });
    expect(loadPage).toHaveBeenCalledTimes(1);
  });

  it('patches a local metadata change without dropping an unaffected page', async () => {
    const current = item({ rowVersion: 2 });
    const coordinator = new AdminTypePageCoordinator(
      new CacheKernel(),
      vi.fn().mockResolvedValue({ items: [item()], total: 1, page: 1, pageCount: 1 }),
      vi.fn().mockResolvedValue(current), vi.fn().mockResolvedValue(true),
    );
    await coordinator.read('node', { page: 1, pageSize: 25 });
    await coordinator.reconcile('node', 'project');
    await expect(coordinator.read('node', { page: 1, pageSize: 25 })).resolves.toMatchObject({ items: [current] });
  });

  it('keeps node and entity type windows isolated', async () => {
    const loadPage = vi.fn((kind: 'node' | 'entity') => Promise.resolve({ items: [item({ id: `${kind}-type`, kind })], total: 1, page: 1, pageCount: 1 }));
    const coordinator = new AdminTypePageCoordinator(new CacheKernel(), loadPage, vi.fn(), vi.fn().mockResolvedValue(true));
    await coordinator.read('node', { page: 1, pageSize: 25 });
    await coordinator.read('entity', { page: 1, pageSize: 25 });
    expect(loadPage).toHaveBeenCalledTimes(2);
  });
});
