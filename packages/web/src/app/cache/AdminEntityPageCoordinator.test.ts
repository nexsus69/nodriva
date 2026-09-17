/** Verifies the entity catalogue keeps records once and evicts unreferenced summaries with their window. */
import { describe, expect, it, vi } from 'vitest';
import type { AdminContentCatalogPage } from '@dashboard/core';
import { CacheKernel } from './CacheKernel';
import { AdminEntityPageCoordinator } from './AdminEntityPageCoordinator';

const item = (id: string) => ({ id, parentNodeId: 'node-1', entityTypeId: 'type-1', name: id, description: '', rowVersion: 1, nodeName: 'Node', nodePath: '/node', typeLabel: 'Type' });
const page = (id: string, number: number): AdminContentCatalogPage<ReturnType<typeof item>> => ({ items: [item(id)], total: 10, page: number, pageCount: 10 });

describe('AdminEntityPageCoordinator', () => {
  it('reuses a continuous window and selectively drops only windows referencing an entity', async () => {
    const load = vi.fn(async (input: { page: number }) => page(`entity-${input.page}`, input.page));
    const kernel = new CacheKernel();
    const coordinator = new AdminEntityPageCoordinator(kernel, load, async () => null, async () => true);
    const request = (number: number) => ({ page: number, pageSize: 25 });

    await coordinator.read(request(1));
    await coordinator.read(request(2));
    expect((await coordinator.read(request(1))).items).toEqual([item('entity-1')]);
    expect(load).toHaveBeenCalledTimes(2);

    coordinator.invalidateResource('entity-1');
    await coordinator.read(request(2));
    expect(load).toHaveBeenCalledTimes(2);
    expect(kernel.getRecord('admin-entity', 'entity-1')).toBeNull();
  });

  it('does not publish a backend page that completed after its family was invalidated', async () => {
    let complete: ((value: AdminContentCatalogPage<ReturnType<typeof item>>) => void) | undefined;
    const load = vi.fn(() => new Promise<AdminContentCatalogPage<ReturnType<typeof item>>>((resolve) => { complete = resolve; }));
    const coordinator = new AdminEntityPageCoordinator(new CacheKernel(), load, async () => null, async () => true);
    const request = { page: 1, pageSize: 25 };
    const pending = coordinator.read(request);
    coordinator.invalidateFamily();
    complete!(page('old', 1));
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    complete!(page('current', 1));
    await expect(pending).resolves.toMatchObject({ items: [item('current')] });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('bounds canonical summaries to the records retained by its five query windows', async () => {
    const load = vi.fn(async (input: { page: number }) => page(`entity-${input.page}`, input.page));
    const kernel = new CacheKernel();
    const coordinator = new AdminEntityPageCoordinator(kernel, load, async () => null, async () => true);
    for (let number = 1; number <= 6; number += 1) await coordinator.read({ page: number, pageSize: 25 });

    expect(kernel.getRecord('admin-entity', 'entity-1')).toBeNull();
    expect(kernel.getRecord('admin-entity', 'entity-2')).toEqual(item('entity-2'));
  });

  it('reconciles a neutral realtime update into the canonical summary without discarding its page', async () => {
    const load = vi.fn(async (input: { page: number }) => page(`entity-${input.page}`, input.page));
    const kernel = new CacheKernel();
    const coordinator = new AdminEntityPageCoordinator(
      kernel,
      load,
      async () => ({ ...item('entity-1'), description: 'reconciled', rowVersion: 2 }),
      async () => true,
    );
    const request = { page: 1, pageSize: 25 };
    await coordinator.read(request);

    await expect(coordinator.reconcileRealtimeEntity('entity-1', 'updated')).resolves.toBe('patch-record');
    await expect(coordinator.read(request)).resolves.toMatchObject({ items: [{ description: 'reconciled', rowVersion: 2 }] });
    expect(load).toHaveBeenCalledOnce();
  });

  it('invalidates only the cached query family whose membership changes', async () => {
    const load = vi.fn(async (input: { search?: string; page: number }) => input.search === 'other'
      ? page('entity-2', input.page)
      : { ...page('entity-1', input.page), items: [{ ...item('entity-1'), name: 'Task' }] });
    const kernel = new CacheKernel();
    const coordinator = new AdminEntityPageCoordinator(
      kernel,
      load,
      async () => ({ ...item('entity-1'), name: 'Issue', rowVersion: 2 }),
      async () => true,
    );
    const task = { page: 1, pageSize: 25, search: 'task' };
    const other = { page: 1, pageSize: 25, search: 'other' };
    await coordinator.read(task);
    await coordinator.read(other);

    await expect(coordinator.reconcileRealtimeEntity('entity-1', 'updated')).resolves.toBe('invalidate-family');
    await coordinator.read(other);
    await coordinator.read(task);
    expect(load).toHaveBeenCalledTimes(3);
  });
});
