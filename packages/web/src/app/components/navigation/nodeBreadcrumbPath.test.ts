import { describe, expect, it } from 'vitest';
import type { ClientNode } from '../../types/models';
import { buildCachedBreadcrumbPath } from './nodeBreadcrumbPath';

function node(id: string, parentId: string | null, name: string): ClientNode {
  return {
    id,
    parentId,
    name,
    description: '',
    path: name.toLowerCase(),
    pathLabel: name.toLowerCase(),
    depth: parentId ? 1 : 0,
    nodeTypeId: 'folder',
    rowVersion: 1,
  };
}

describe('buildCachedBreadcrumbPath', () => {
  it('returns the complete root-to-current-node chain', () => {
    const entries = new Map([
      ['root', node('root', null, 'Root')],
      ['branch', node('branch', 'root', 'Branch')],
      ['leaf', node('leaf', 'branch', 'Leaf')],
    ]);

    const result = buildCachedBreadcrumbPath(
      'leaf',
      (id) => entries.get(id) ?? null
    );

    expect(result.nodes.map((item) => item.id)).toEqual(['root', 'branch', 'leaf']);
    expect(result.isComplete).toBe(true);
  });

  it('returns the known suffix while an ancestor is missing', () => {
    const leaf = node('leaf', 'missing-parent', 'Leaf');
    const result = buildCachedBreadcrumbPath(
      'leaf',
      (id) => (id === 'leaf' ? leaf : null)
    );

    expect(result.nodes.map((item) => item.id)).toEqual(['leaf']);
    expect(result.isComplete).toBe(false);
  });

  it('stops safely when corrupted data contains a parent cycle', () => {
    const entries = new Map([
      ['a', node('a', 'b', 'A')],
      ['b', node('b', 'a', 'B')],
    ]);

    const result = buildCachedBreadcrumbPath(
      'a',
      (id) => entries.get(id) ?? null
    );

    expect(result.nodes).toHaveLength(2);
    expect(result.isComplete).toBe(false);
  });
});
