/** Verifies that Admin content detail links cannot resolve to operational routes. */
import { describe, expect, it } from 'vitest';
import { adminEntityDetailHref, adminNodeDetailHref, parseAdminContentDetailRoute } from './adminContentDetailRoute';

describe('Admin content detail routes', () => {
  it('keeps node and entity detail navigation inside Admin Content', () => {
    expect(adminNodeDetailHref('node-1')).toBe('/admin/content/nodes/node-1');
    expect(adminEntityDetailHref('node-1', 'entity-1')).toBe('/admin/content/entities/node-1/entity-1');
  });

  it('accepts only complete Admin detail paths', () => {
    expect(parseAdminContentDetailRoute('/admin/content/nodes/node-1')).toEqual({ kind: 'node', nodeId: 'node-1' });
    expect(parseAdminContentDetailRoute('/admin/content/entities/node-1/entity-1')).toEqual({ kind: 'entity', parentNodeId: 'node-1', entityId: 'entity-1' });
    expect(parseAdminContentDetailRoute('/nodes/node-1')).toBeNull();
    expect(parseAdminContentDetailRoute('/admin/content/entities/entity-1')).toBeNull();
  });
});
