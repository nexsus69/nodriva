/** Verifies node cache impact is derived from each query descriptor, not a fixed field list. */
import { describe, expect, it } from 'vitest';
import { AdminNodeQueryImpactPolicy, type AdminNodeQueryDescriptor } from './AdminNodeQueryImpactPolicy';

const summary = (overrides: Record<string, unknown> = {}) => ({
  id: 'node-1', parentId: null, nodeTypeId: 'type-1', name: 'Project', description: 'old', path: 'root.project', pathLabel: 'Project', rowVersion: 1, typeLabel: 'Folder', ...overrides,
});
const query = (overrides: Partial<AdminNodeQueryDescriptor> = {}): AdminNodeQueryDescriptor => ({ familyKey: 'all', orderFields: ['path', 'name', 'id'], ...overrides });

describe('AdminNodeQueryImpactPolicy', () => {
  it('patches fields outside the actual descriptor', () => {
    expect(new AdminNodeQueryImpactPolicy().decide(summary(), summary({ description: 'new', rowVersion: 2 }), query())).toBe('patch-record');
  });

  it('patches a rename for a descriptor ordered exclusively by immutable id', () => {
    expect(new AdminNodeQueryImpactPolicy().decide(summary(), summary({ name: 'Renamed' }), query({ orderFields: ['id'] }))).toBe('patch-record');
  });

  it('invalidates only when the descriptor search or stable order changes', () => {
    const policy = new AdminNodeQueryImpactPolicy();
    expect(policy.decide(summary(), summary({ name: 'Renamed' }), query({ orderFields: ['name', 'id'] }))).toBe('invalidate-family');
    expect(policy.decide(summary(), summary({ name: 'Issue' }), query({ search: 'project' }))).toBe('invalidate-family');
  });
});
