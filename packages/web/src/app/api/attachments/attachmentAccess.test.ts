import { describe, expect, it } from 'vitest';
import { attachmentPermission } from './attachmentAccess';

describe('attachment permissions', () => {
  it('separates read access from write access', () => {
    expect(attachmentPermission('node', 'read')).toBe('node.read');
    expect(attachmentPermission('entity', 'read')).toBe('entity.read');
    expect(attachmentPermission('node', 'write')).toBe('node.edit');
    expect(attachmentPermission('entity', 'write')).toBe('entity.edit');
  });
});
