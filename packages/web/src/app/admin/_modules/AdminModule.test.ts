/** Verifies recursive module contracts, ordering, lookup, and authorization projections. */
import { describe, expect, it } from 'vitest';
import { ADMIN_MODULES, AdminModuleRegistry } from './AdminModuleRegistry';

describe('AdminModuleRegistry', () => {
  it('keeps every level on the same recursive module contract', () => {
    const registry = new AdminModuleRegistry();

    expect(registry.find('model')?.children?.[0]?.key).toBe('model.types');
    expect(registry.find('model.types')?.route).toBe('/admin/types');
  });

  it('sorts modules and children by order', () => {
    const registry = new AdminModuleRegistry([
      { key: 'z', label: 'Z', order: 20, route: '/z' },
      { key: 'a', label: 'A', order: 10, route: '/a', children: [
        { key: 'a.z', label: 'Z', order: 20, route: '/a/z' },
        { key: 'a.a', label: 'A', order: 10, route: '/a/a' },
      ] },
    ]);

    expect(registry.all().map((module) => module.key)).toEqual(['a', 'z']);
    expect(registry.find('a')?.children?.map((module) => module.key)).toEqual(['a.a', 'a.z']);
  });

  it('filters unauthorized leaves while retaining visible parents', () => {
    const registry = new AdminModuleRegistry(ADMIN_MODULES);
    const visible = registry.visible({ permissions: new Set(['user.read']) });

    expect(visible.map((module) => module.key)).toEqual(['overview', 'access']);
    expect(visible.find((module) => module.key === 'access')?.children?.map((module) => module.key)).toEqual(['access.users']);
  });

  it('supports any-permission modules for shared administration surfaces', () => {
    const registry = new AdminModuleRegistry([
      { key: 'model', label: 'Model', order: 1, children: [{ key: 'types', label: 'Types', order: 1, route: '/types', requiredPermissions: ['node_type.read', 'entity_type.read'], permissionMode: 'any' }] },
    ]);

    expect(registry.visible({ permissions: new Set(['entity_type.read']) })).toHaveLength(1);
  });
});
