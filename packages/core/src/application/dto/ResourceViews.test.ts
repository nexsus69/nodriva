import { describe, expect, it } from 'vitest';
import { resourceActionDefinition, resourceViewDefinition } from './ResourceViews.js';

describe('resource views and actions', () => {
  it('builds metadata for a reusable resource view', () => {
    expect(resourceViewDefinition('customers', { resourceType: 'entity', typeKey: 'customer' }, [
      { key: 'name', label: 'Nome', kind: 'text', sortable: true },
    ], [{ key: 'status', label: 'Stato', kind: 'select', options: [{ value: 'active', label: 'Attivo' }] }])).toEqual({
      key: 'customers',
      resource: { resourceType: 'entity', typeKey: 'customer' },
      columns: [{ key: 'name', label: 'Nome', kind: 'text', sortable: true }],
      filters: [{ key: 'status', label: 'Stato', kind: 'select', options: [{ value: 'active', label: 'Attivo' }] }],
    });
  });

  it('keeps action policy metadata separate from rendering', () => {
    expect(resourceActionDefinition('delete', 'Elimina', { permission: 'customer.delete', destructive: true })).toEqual({
      key: 'delete', label: 'Elimina', permission: 'customer.delete', destructive: true,
    });
  });
});
