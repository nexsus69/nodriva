/** Verifies that collection reconciliation cannot replace an open admin draft. */
import { describe, expect, it } from 'vitest';
import { resolveAdminFormSurfaceState } from './useAdminFormSurface';
import {
  DEFAULT_ADMIN_WORKSPACE_STATE,
  mergeAdminWorkspaceState,
  type AdminWorkspaceState,
} from './AdminWorkspaceStore';

function workspaceState(overrides: Partial<AdminWorkspaceState>): AdminWorkspaceState {
  return {
    ...DEFAULT_ADMIN_WORKSPACE_STATE,
    hasHydrated: false,
    setHasHydrated: () => undefined,
    setUserContext: () => undefined,
    setActiveModule: () => undefined,
    expandModule: () => undefined,
    toggleModule: () => undefined,
    selectResource: () => undefined,
    openSurface: () => undefined,
    closeSurface: () => undefined,
    saveDraft: () => undefined,
    removeDraft: () => undefined,
    setModuleState: () => undefined,
    clearModuleState: () => undefined,
    resetWorkspace: () => undefined,
    ...overrides,
  };
}

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

  it('treats a restored draft as authoritative over a later list refresh', () => {
    const state = resolveAdminFormSurfaceState({
      initialValues: { typeKey: '', name: '' },
      draft: { key: 'model.types.create', values: { typeKey: 'project_task', name: 'Project task' }, baseline: { typeKey: '', name: '' }, formVersion: '1', updatedAt: 2 },
      surface: { kind: 'drawer', key: 'type-create:node', moduleKey: 'model.types', mode: 'create' },
      moduleKey: 'model.types', surfaceKey: 'type-create:node',
    });
    expect(state.values).toEqual({ typeKey: 'project_task', name: 'Project task' });
  });

  it('opens an explicit form request before workspace hydration completes', () => {
    const state = resolveAdminFormSurfaceState({
      initialValues: { name: '' },
      surface: null,
      moduleKey: 'model.types',
      surfaceKey: 'type-create',
      hasHydrated: false,
      explicitlyOpened: true,
    });

    expect(state.isOpen).toBe(true);
  });

  it('does not expose a restored form before hydration', () => {
    const state = resolveAdminFormSurfaceState({
      initialValues: { name: '' },
      surface: { kind: 'modal', key: 'type-create', moduleKey: 'model.types', mode: 'create' },
      moduleKey: 'model.types',
      surfaceKey: 'type-create',
      hasHydrated: false,
    });

    expect(state.isOpen).toBe(false);
  });

  it('does not let an empty persisted identity erase a form opened by the authenticated user', () => {
    const current = workspaceState({
      userId: 'current-user',
      surface: { kind: 'drawer', key: 'type-create:entity', moduleKey: 'model.types', mode: 'create' },
      drafts: {
        'model.types:type-create:entity': {
          key: 'model.types:type-create:entity',
          values: { typeKey: 'project_task', name: 'Project task' },
          baseline: { typeKey: '', name: '' },
          formVersion: '1',
          updatedAt: 1,
        },
      },
    });

    const merged = mergeAdminWorkspaceState({ userId: null, drafts: {}, moduleState: {} }, current);

    expect(merged.userId).toBe('current-user');
    expect(merged.surface).toEqual(current.surface);
    expect(merged.drafts).toEqual(current.drafts);
  });
});
