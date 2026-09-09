/** Verifies that collection reconciliation cannot replace an open admin draft. */
import { describe, expect, it } from 'vitest';
import { resolveAdminFormSurfaceState } from './useAdminFormSurface';

describe('Admin form surface lifecycle', () => {
  it('preserves an open draft when the collection receives a refreshed server projection', () => {
    const state = resolveAdminFormSurfaceState({
      initialValues: { name: 'Server value after refresh' },
      draft: {
        key: 'example.module.edit',
        values: { name: 'Local draft' },
        baseline: { name: 'Server value before refresh' },
        formVersion: '1',
        updatedAt: 1,
      },
      surface: { kind: 'modal', key: 'edit', moduleKey: 'example.module', mode: 'edit', resourceId: 'record-1' },
      moduleKey: 'example.module',
      surfaceKey: 'edit',
    });

    expect(state).toEqual({ values: { name: 'Local draft' }, isOpen: true, isDirty: true });
  });
});
