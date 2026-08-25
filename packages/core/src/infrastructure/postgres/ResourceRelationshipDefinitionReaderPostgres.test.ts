import { describe, expect, it, vi } from 'vitest';
import { ResourceRelationshipDefinitionReaderPostgres } from './ResourceRelationshipDefinitionReaderPostgres.js';

describe('ResourceRelationshipDefinitionReaderPostgres', () => {
  it('maps active inverse relation metadata without exposing PostgreSQL rows', async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          source_domain: 'entity',
          source_type_key: 'task',
          source_type_name: 'Task',
          source_field_id: '11111111-1111-4111-8111-111111111111',
          source_field_key: 'documents',
          source_field_label: 'Documents',
          source_cardinality: 'many',
          target_is_unique: false,
          inverse_label: 'Used by tasks',
        }],
      }),
    };
    const reader = new ResourceRelationshipDefinitionReaderPostgres(executor as never);

    await expect(reader.listIncomingDefinitions('entity', 'document')).resolves.toEqual([
      {
        sourceDomain: 'entity',
        sourceTypeKey: 'task',
        sourceTypeName: 'Task',
        sourceFieldId: '11111111-1111-4111-8111-111111111111',
        sourceFieldKey: 'documents',
        sourceFieldLabel: 'Documents',
        sourceCardinality: 'many',
        targetIsUnique: false,
        inverseLabel: 'Used by tasks',
      },
    ]);
    expect(executor.query).toHaveBeenCalledWith(expect.any(String), ['entity', 'document']);
  });
});
