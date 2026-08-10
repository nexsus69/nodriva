import { describe, expect, it } from 'vitest';
import { buildResourceFormSchema } from './ResourceFormRenderer';

describe('buildResourceFormSchema', () => {
  it('maps every supported resource data type to an appropriate control', () => {
    const fields = buildResourceFormSchema([
      ...(['string', 'text', 'uuid'] as const).map((dataType) => ({ fieldKey: dataType, dataType, label: dataType, isRequired: false, constraints: [], relationTarget: null })),
      ...(['integer', 'number', 'decimal'] as const).map((dataType) => ({ fieldKey: dataType, dataType, label: dataType, isRequired: false, constraints: [], relationTarget: null })),
      ...(['boolean', 'date', 'datetime', 'json', 'array', 'enum', 'relation'] as const).map((dataType) => ({ fieldKey: dataType, dataType, label: dataType, isRequired: false, constraints: [], relationTarget: null })),
    ], { enum: { options: [{ value: 'active', label: 'Attivo' }] }, relation: { options: [{ value: '1', label: 'Uno' }] } });

    expect(fields.map((field) => field.type)).toEqual([
      'text', 'text', 'text', 'number', 'number', 'number', 'boolean', 'date', 'datetime-local', 'textarea', 'textarea', 'select', 'select',
    ]);
  });

  it('maps resource field definitions to renderer fields', () => {
    const fields = buildResourceFormSchema([
      { fieldKey: 'active', label: 'Attivo', dataType: 'boolean', isRequired: false, constraints: [], relationTarget: null },
      { fieldKey: 'amount', label: 'Importo', dataType: 'decimal', isRequired: true, constraints: [], relationTarget: null },
      { fieldKey: 'status', label: 'Stato', dataType: 'enum', isRequired: true, constraints: [], relationTarget: null },
      { fieldKey: 'owner', label: 'Proprietario', dataType: 'relation', isRequired: false, constraints: [], relationTarget: { resourceType: 'entity', typeKey: 'user' } },
    ], { status: { options: [{ value: 'open', label: 'Aperto' }] }, owner: { options: [{ value: '1', label: 'Mario' }] } });

    expect(fields).toEqual([
      { name: 'active', type: 'boolean', label: 'Attivo' },
      { name: 'amount', type: 'number', label: 'Importo', required: true },
      { name: 'status', type: 'select', label: 'Stato', required: true, options: [{ value: 'open', label: 'Aperto' }] },
      { name: 'owner', type: 'select', label: 'Proprietario', required: false, options: [{ value: '1', label: 'Mario' }] },
    ]);
  });
});
