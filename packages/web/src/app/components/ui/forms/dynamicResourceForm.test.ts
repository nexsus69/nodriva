/** Tests form coercion and versioned attachment retries without duplicate uploads. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DynamicField } from './DynamicFieldsForm';
import { coerceDynamicPayload, initializeDynamicPayload, isAttachmentField, uploadDynamicAttachments } from './dynamicResourceForm';
import { uploadResourceAttachment } from '../../../attachments/attachmentClient';
import { acquireLockAction, releaseLockAction } from '../../../actions/lockActions';

vi.mock('../../../attachments/attachmentClient', () => ({ uploadResourceAttachment: vi.fn(), validateResourceAttachmentFile: vi.fn() }));
vi.mock('../../../actions/lockActions', () => ({ acquireLockAction: vi.fn(), releaseLockAction: vi.fn() }));

const fields = [
  { fieldKey: 'enabled', dataType: 'boolean' },
  { fieldKey: 'quantity', dataType: 'integer' },
  { fieldKey: 'label', dataType: 'string' },
  { fieldKey: 'dependency', dataType: 'relation', isRequired: false },
  { fieldKey: 'document', dataType: 'file' },
] as DynamicField[];

describe('dynamicResourceForm', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('chains versions and resumes after partial failure without re-uploading completed files', async () => {
    const first = new File(['one'], 'one.txt');
    const second = new File(['two'], 'two.txt');
    const completedFiles = new Set<File>();
    const onUploaded = vi.fn();
    vi.mocked(acquireLockAction).mockResolvedValue({ success: true } as never);
    vi.mocked(releaseLockAction).mockResolvedValue({ success: true } as never);
    vi.mocked(uploadResourceAttachment).mockResolvedValueOnce({ rowVersion: 2 } as never).mockRejectedValueOnce(new Error('network'));
    await expect(uploadDynamicAttachments('node', 'node', fields, { document: [first, second] }, { expectedRowVersion: 1, acquireLock: true, completedFiles, onUploaded })).rejects.toThrow('network');
    expect(completedFiles).toEqual(new Set([first]));
    expect(onUploaded).toHaveBeenCalledWith(2, 'document', first);
    expect(releaseLockAction).toHaveBeenCalledOnce();
    vi.mocked(uploadResourceAttachment).mockResolvedValueOnce({ rowVersion: 3 } as never);
    await expect(uploadDynamicAttachments('node', 'node', fields, { document: [first, second] }, { expectedRowVersion: 2, acquireLock: true, completedFiles })).resolves.toBe(3);
    expect(vi.mocked(uploadResourceAttachment).mock.calls.map(([input]) => [input.file.name, input.expectedRowVersion])).toEqual([['one.txt', 1], ['two.txt', 2], ['two.txt', 2]]);
  });

  it('does not upload or release another session’s lock after acquisition is denied', async () => {
    vi.mocked(acquireLockAction).mockResolvedValue({ success: false, error: 'LOCK_CONFLICT', message: 'Conflict' } as never);
    await expect(uploadDynamicAttachments('entity', 'entity', fields, { document: [new File(['one'], 'one.txt')] }, { expectedRowVersion: 1, acquireLock: true })).rejects.toMatchObject({ code: 'LOCK_CONFLICT' });
    expect(uploadResourceAttachment).not.toHaveBeenCalled();
    expect(releaseLockAction).not.toHaveBeenCalled();
  });
  it('initializes editable fields while excluding attachments', () => {
    expect(initializeDynamicPayload(fields)).toEqual({ enabled: false, quantity: '', label: '', dependency: '' });
    expect(isAttachmentField(fields[4]!)).toBe(true);
  });

  it('coerces numeric and boolean values consistently for nodes and entities', () => {
    expect(coerceDynamicPayload(fields, { enabled: 1, quantity: '12', label: 'sample', dependency: '' })).toEqual({
      enabled: true,
      quantity: 12,
      label: 'sample',
      dependency: null,
    });
    expect(coerceDynamicPayload(fields, { enabled: false, quantity: '', label: '' }).quantity).toBeNull();
  });
});
