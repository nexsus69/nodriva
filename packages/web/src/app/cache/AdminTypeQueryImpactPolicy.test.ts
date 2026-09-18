/** Covers type catalogue membership and ordering impact decisions. */
import { describe, expect, it } from 'vitest';
import type { TypeListItemDto } from '@dashboard/core';
import { AdminTypeQueryImpactPolicy } from './AdminTypeQueryImpactPolicy';

const item = (patch: Partial<TypeListItemDto> = {}): TypeListItemDto => ({
  id: 'type-1', kind: 'node', typeKey: 'project', name: 'Project', description: 'Operational project', storageTable: null,
  currentSchemaVersion: 1, isActive: true, isSystem: false, rowVersion: 1, fieldCount: 2, updatedAt: '2026-01-01T00:00:00.000Z', ...patch,
});

describe('AdminTypeQueryImpactPolicy', () => {
  it('patches a retained type when list membership and ordering are unchanged', () => {
    expect(new AdminTypeQueryImpactPolicy().decide(item(), item({ rowVersion: 2 }), {
      familyKey: 'types', orderFields: ['name', 'id'],
    })).toBe('patch-record');
  });

  it('invalidates only the query family when a search or sort field changes', () => {
    const policy = new AdminTypeQueryImpactPolicy();
    expect(policy.decide(item(), item({ name: 'Programme' }), { familyKey: 'search', search: 'project', orderFields: ['name', 'id'] })).toBe('invalidate-family');
    expect(policy.decide(item(), item({ fieldCount: 3 }), { familyKey: 'fields', orderFields: ['fieldCount', 'name', 'id'] })).toBe('invalidate-family');
  });
});
