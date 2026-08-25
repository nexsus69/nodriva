import { afterEach, describe, expect, it } from 'vitest';
import { SqliteInfrastructure } from './SqliteInfrastructure.js';

let infrastructure: SqliteInfrastructure | undefined;

afterEach(() => {
  infrastructure?.close();
  infrastructure = undefined;
});

describe('ResourceRelationshipDefinitionReaderSqlite', () => {
  it('lists only active relation fields that target the requested type', async () => {
    infrastructure = new SqliteInfrastructure(':memory:');
    const { database, resourceRelationshipDefinitionReader } = infrastructure;

    database.run('INSERT INTO node_types(id,type_key,name,is_active) VALUES(?,?,?,?)', [
      'node-source-type', 'project', 'Project', 1,
    ]);
    database.run('INSERT INTO entity_types(id,type_key,name,storage_table,is_active) VALUES(?,?,?,?,?)', [
      'entity-source-type', 'task', 'Task', 'entity_task', 1,
    ]);
    database.run('INSERT INTO entity_types(id,type_key,name,storage_table,is_active) VALUES(?,?,?,?,?)', [
      'entity-target-type', 'document', 'Document', 'entity_document', 1,
    ]);
    database.run('INSERT INTO node_type_fields(id,node_type_id,field_key,label,column_name,data_type,position,relation_target_domain,relation_target_type_key,relation_source_cardinality,relation_target_is_unique,relation_inverse_label) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [
      'project-documents', 'node-source-type', 'documents', 'Documents', 'documents', 'relation', 2,
      'entity', 'document', 'many', 0, 'Used by projects',
    ]);
    database.run('INSERT INTO entity_type_fields(id,entity_type_id,field_key,label,column_name,data_type,position,relation_target_domain,relation_target_type_key,relation_source_cardinality,relation_target_is_unique) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [
      'task-document', 'entity-source-type', 'document', 'Document', 'document', 'relation', 1,
      'entity', 'document', 'one', 1,
    ]);
    database.run('INSERT INTO entity_type_fields(id,entity_type_id,field_key,label,column_name,data_type,position,relation_target_domain,relation_target_type_key) VALUES(?,?,?,?,?,?,?,?,?)', [
      'other-target', 'entity-source-type', 'other', 'Other', 'other', 'relation', 0,
      'entity', 'other-type',
    ]);

    await expect(
      resourceRelationshipDefinitionReader.listIncomingDefinitions('entity', 'document'),
    ).resolves.toEqual([
      {
        sourceDomain: 'node',
        sourceTypeKey: 'project',
        sourceTypeName: 'Project',
        sourceFieldId: 'project-documents',
        sourceFieldKey: 'documents',
        sourceFieldLabel: 'Documents',
        sourceCardinality: 'many',
        targetIsUnique: false,
        inverseLabel: 'Used by projects',
      },
      {
        sourceDomain: 'entity',
        sourceTypeKey: 'task',
        sourceTypeName: 'Task',
        sourceFieldId: 'task-document',
        sourceFieldKey: 'document',
        sourceFieldLabel: 'Document',
        sourceCardinality: 'one',
        targetIsUnique: true,
        inverseLabel: null,
      },
    ]);
  });
});
