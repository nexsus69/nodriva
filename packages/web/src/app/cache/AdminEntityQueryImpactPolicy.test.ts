/** Verifies entity cache impact is derived from each query descriptor, not a fixed field list. */
import { describe, expect, it } from 'vitest';
import { AdminEntityQueryImpactPolicy, type AdminEntityQueryDescriptor } from './AdminEntityQueryImpactPolicy';

const summary = (overrides: Record<string, unknown> = {}) => ({
  id: 'entity-1', parentNodeId: 'node-1', entityTypeId: 'type-1', name: 'Task', description: 'old',
  rowVersion: 1, nodeName: 'Node', nodePath: 'root.node', typeLabel: 'Task', ...overrides,
});
const query = (overrides: Partial<AdminEntityQueryDescriptor> = {}): AdminEntityQueryDescriptor => ({ familyKey: 'all', orderFields: ['nodePath', 'name', 'id'], ...overrides });

describe('AdminEntityQueryImpactPolicy', () => {
  it('patches fields outside the actual descriptor', () => {
    expect(new AdminEntityQueryImpactPolicy().decide(summary(), summary({ description: 'new', rowVersion: 2 }), query()))
      .toBe('patch-record');
  });

  it('patches a rename for a descriptor ordered exclusively by immutable id', () => {
    expect(new AdminEntityQueryImpactPolicy().decide(summary(), summary({ name: 'Renamed' }), query({ orderFields: ['id'] })))
      .toBe('patch-record');
  });

  it('invalidates only when the descriptor search or stable order changes', () => {
    const policy = new AdminEntityQueryImpactPolicy();
    expect(policy.decide(summary(), summary({ name: 'Renamed' }), query({ orderFields: ['name', 'id'] })))
      .toBe('invalidate-family');
    expect(policy.decide(summary(), summary({ name: 'Issue' }), query({ search: 'task' }))).toBe('invalidate-family');
  });
});
