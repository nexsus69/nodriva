/** Verifies resource metadata to shared form-definition conversion. */
import { describe, expect, it } from 'vitest';
import { buildResourceFormSchema } from './ResourceFormRenderer';

describe('buildResourceFormSchema', () => {
  const plaintext = { encryptionMode: 'plaintext' as const };
  it('maps every supported resource data type to an appropriate control', () => {
    const fields = buildResourceFormSchema([
      ...(['string', 'text', 'uuid'] as const).map((dataType) => ({ ...plaintext, fieldKey: dataType, dataType, label: dataType, isRequired: false, constraints: [], relationTarget: null })),
      ...(['integer', 'number', 'decimal'] as const).map((dataType) => ({ ...plaintext, fieldKey: dataType, dataType, label: dataType, isRequired: false, constraints: [], relationTarget: null })),
      ...(['boolean', 'date', 'datetime', 'json', 'array', 'enum', 'relation'] as const).map((dataType) => ({ ...plaintext, fieldKey: dataType, dataType, label: dataType, isRequired: false, constraints: [], relationTarget: null })),
    ], { enum: { options: [{ value: 'active', label: 'Attivo' }] }, relation: { options: [{ value: '1', label: 'Uno' }] } });

    expect(fields.map((field) => field.type)).toEqual([
      'text', 'text', 'text', 'number', 'number', 'number', 'boolean', 'date', 'datetime-local', 'textarea', 'textarea', 'select', 'select',
    ]);
  });

  it('maps resource field definitions to renderer fields', () => {
    const fields = buildResourceFormSchema([
      { ...plaintext, fieldKey: 'active', label: 'Attivo', dataType: 'boolean', isRequired: false, constraints: [], relationTarget: null },
      { ...plaintext, fieldKey: 'amount', label: 'Importo', dataType: 'decimal', isRequired: true, constraints: [], relationTarget: null },
      { ...plaintext, fieldKey: 'status', label: 'Stato', dataType: 'enum', isRequired: true, constraints: [], relationTarget: null },
      { ...plaintext, fieldKey: 'owner', label: 'Proprietario', dataType: 'relation', isRequired: false, constraints: [], relationTarget: { resourceType: 'entity', typeKey: 'user' } },
      { ...plaintext, fieldKey: 'document', label: 'Documento', dataType: 'file', isRequired: false, constraints: [], relationTarget: null },
      { ...plaintext, fieldKey: 'photo', label: 'Foto', dataType: 'image', isRequired: false, constraints: [], relationTarget: null },
    ], { status: { options: [{ value: 'open', label: 'Aperto' }] }, owner: { options: [{ value: '1', label: 'Mario' }] } });

    expect(fields).toEqual([
      { name: 'active', type: 'boolean', label: 'Attivo' },
      { name: 'amount', type: 'number', label: 'Importo', required: true },
      { name: 'status', type: 'select', label: 'Stato', required: true, options: [{ value: 'open', label: 'Aperto' }] },
      { name: 'owner', type: 'relation', label: 'Proprietario', required: false, resourceType: 'entity', typeKey: 'user' },
      { name: 'document', type: 'attachment', label: 'Documento', required: false, kind: 'file' },
      { name: 'photo', type: 'attachment', label: 'Foto', required: false, kind: 'image' },
    ]);
  });

  it('normalizes legacy type-definition enum and relation metadata', () => {
    const fields = buildResourceFormSchema([
      {
        fieldKey: 'state',
        ...plaintext,
        label: 'State',
        dataType: 'enum',
        isRequired: true,
        constraints: [],
        enumOptions: [
          { value: 'open', label: 'Open', isActive: true },
          { value: 'closed', label: 'Closed', isActive: false },
        ],
      },
      {
        fieldKey: 'owner',
        ...plaintext,
        label: 'Owner',
        dataType: 'relation',
        isRequired: false,
        constraints: [],
        relationTargetDomain: 'entity',
        relationTargetTypeKey: 'user',
      },
    ]);

    expect(fields).toEqual([
      {
        name: 'state',
        type: 'select',
        label: 'State',
        required: true,
        options: [{ value: 'open', label: 'Open' }],
      },
      {
        name: 'owner',
        type: 'relation',
        label: 'Owner',
        required: false,
        resourceType: 'entity',
        typeKey: 'user',
      },
    ]);
  });

  it('marks configured encrypted fields when global encryption is disabled', () => {
    const fields = buildResourceFormSchema([{
      fieldKey: 'subject', label: 'Subject', dataType: 'string', isRequired: false,
      constraints: [], relationTarget: null, encryptionMode: 'encrypted', encryptionCapabilityEnabled: false,
    }]);
    expect(fields[0]?.description).toContain('disabilitata');
  });
});
