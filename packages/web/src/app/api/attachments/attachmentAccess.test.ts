import { describe, expect, it } from 'vitest';
import { AppError } from '@dashboard/core';
import { attachmentPermission, isAttachmentAccessDenied, parseAttachmentTarget } from './attachmentAccess';

describe('attachment permissions', () => {
  it('separates read access from write access', () => {
    expect(attachmentPermission('node', 'read')).toBe('node.read');
    expect(attachmentPermission('entity', 'read')).toBe('entity.read');
    expect(attachmentPermission('node', 'write')).toBe('node.edit');
    expect(attachmentPermission('entity', 'write')).toBe('entity.edit');
  });
});

describe('parseAttachmentTarget', () => {
  it('accepts seeded UUIDs without an RFC version nibble', () => {
    expect(parseAttachmentTarget({
      resourceType: 'node',
      resourceId: '00000000-0000-0000-0000-000000000071',
      fieldKey: 'attachments',
      kind: 'file',
    })).toMatchObject({ resourceType: 'node', resourceId: '00000000-0000-0000-0000-000000000071' });
  });

  it('rejects malformed resource identifiers', () => {
    expect(parseAttachmentTarget({
      resourceType: 'node',
      resourceId: 'not-a-uuid',
      fieldKey: 'attachments',
      kind: 'file',
    })).toBeNull();
  });
});

describe('attachment access error mapping', () => {
  it('maps forbidden access to the resource-not-found policy', () => {
    expect(isAttachmentAccessDenied(new AppError('ACCESS_FORBIDDEN', 'denied'))).toBe(true);
    expect(isAttachmentAccessDenied(new AppError('RESOURCE_NOT_FOUND', 'missing'))).toBe(false);
    expect(isAttachmentAccessDenied(new Error('unexpected'))).toBe(false);
  });
});
