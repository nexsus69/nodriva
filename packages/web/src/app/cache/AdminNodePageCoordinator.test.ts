/** Verifies the node catalogue keeps records once and selectively reconciles retained windows. */
import { describe, expect, it, vi } from 'vitest';
import type { AdminContentCatalogPage } from '@dashboard/core';
import { CacheKernel } from './CacheKernel';
import { AdminNodePageCoordinator } from './AdminNodePageCoordinator';

const item = (id: string) => ({ id, parentId: null, nodeTypeId: 'type-1', name: id, description: '', path: `root.${id}`, pathLabel: id, rowVersion: 1, typeLabel: 'Folder' });
const page = (id: string, number: number): AdminContentCatalogPage<ReturnType<typeof item>> => ({ items: [item(id)], total: 10, page: number, pageCount: 10 });

describe('AdminNodePageCoordinator', () => {
  it('reuses a continuous window and bounds canonical summaries to retained windows', async () => {
    const load = vi.fn(async (input: { page: number }) => page(`node-${input.page}`, input.page));
    const kernel = new CacheKernel();
    const coordinator = new AdminNodePageCoordinator(kernel, load, async () => null, async () => true);
    for (let number = 1; number <= 6; number += 1) await coordinator.read({ page: number, pageSize: 25 });

    await coordinator.read({ page: 6, pageSize: 25 });
    expect(load).toHaveBeenCalledTimes(6);
    expect(kernel.getRecord('admin-node', 'node-1')).toBeNull();
    expect(kernel.getRecord('admin-node', 'node-2')).toEqual(item('node-2'));
  });

  it('patches a neutral realtime update without discarding its page', async () => {
    const load = vi.fn(async (input: { page: number }) => page(`node-${input.page}`, input.page));
    const coordinator = new AdminNodePageCoordinator(new CacheKernel(), load, async () => ({ ...item('node-1'), description: 'reconciled', rowVersion: 2 }), async () => true);
    const request = { page: 1, pageSize: 25 };
    await coordinator.read(request);

    await expect(coordinator.reconcileRealtimeNode('node-1', 'updated')).resolves.toBe('patch-record');
    await expect(coordinator.read(request)).resolves.toMatchObject({ items: [{ description: 'reconciled', rowVersion: 2 }] });
    expect(load).toHaveBeenCalledOnce();
  });

  it('invalidates only the cached query family whose membership changes', async () => {
    const load = vi.fn(async (input: { search?: string; page: number }) => input.search === 'other'
      ? page('node-2', input.page)
      : { ...page('node-1', input.page), items: [{ ...item('node-1'), name: 'Project' }] });
    const coordinator = new AdminNodePageCoordinator(new CacheKernel(), load, async () => ({ ...item('node-1'), name: 'Issue', rowVersion: 2 }), async () => true);
    const project = { page: 1, pageSize: 25, search: 'project' };
    const other = { page: 1, pageSize: 25, search: 'other' };
    await coordinator.read(project);
    await coordinator.read(other);

    await expect(coordinator.reconcileRealtimeNode('node-1', 'updated')).resolves.toBe('invalidate-family');
    await coordinator.read(other);
    await coordinator.read(project);
    expect(load).toHaveBeenCalledTimes(3);
  });
});
