import { describe, expect, it } from 'vitest';
import type { DynamicField } from './DynamicFieldsForm';
import { coerceDynamicPayload, initializeDynamicPayload, isAttachmentField } from './dynamicResourceForm';

const fields = [
  { fieldKey: 'enabled', dataType: 'boolean' },
  { fieldKey: 'quantity', dataType: 'integer' },
  { fieldKey: 'label', dataType: 'string' },
  { fieldKey: 'document', dataType: 'file' },
] as DynamicField[];

describe('dynamicResourceForm', () => {
  it('initializes editable fields while excluding attachments', () => {
    expect(initializeDynamicPayload(fields)).toEqual({ enabled: false, quantity: '', label: '' });
    expect(isAttachmentField(fields[3]!)).toBe(true);
  });

  it('coerces numeric and boolean values consistently for nodes and entities', () => {
    expect(coerceDynamicPayload(fields, { enabled: 1, quantity: '12', label: 'sample' })).toEqual({
      enabled: true,
      quantity: 12,
      label: 'sample',
    });
    expect(coerceDynamicPayload(fields, { enabled: false, quantity: '', label: '' }).quantity).toBeNull();
  });
});
