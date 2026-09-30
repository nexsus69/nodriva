/** Verifies HTTP target validation and safe attachment error semantics. */
import { describe, expect, it } from 'vitest';
import { AppError } from '@dashboard/core';
import { parseAttachmentTarget } from './attachmentAccess';
import { attachmentHttpError } from './attachmentHttp';

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
    expect(attachmentHttpError(new AppError('ACCESS_FORBIDDEN', 'denied')).status).toBe(404);
    expect(attachmentHttpError(new AppError('RESOURCE_NOT_FOUND', 'missing')).status).toBe(404);
    expect(attachmentHttpError(new AppError('ROW_VERSION_MISMATCH', 'conflict')).status).toBe(409);
    expect(attachmentHttpError(new AppError('LOCK_CONFLICT', 'conflict')).status).toBe(409);
    expect(attachmentHttpError(new Error('unexpected')).status).toBe(500);
  });
});
