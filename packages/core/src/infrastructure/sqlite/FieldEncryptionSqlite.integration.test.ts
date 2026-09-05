/** Verifies SQLite repositories are wired to the shared field encryption policy. */
import { describe, expect, it, vi } from 'vitest';
import { Node } from '../../domain/models/Node.js';
import { Entity } from '../../domain/models/Entity.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { FieldEncryptionServiceSqlite } from './FieldEncryptionServiceSqlite.js';
import { NodeRepositorySqlite } from './NodeRepositorySqlite.js';
import { EntityRepositorySqlite } from './EntityRepositorySqlite.js';
import { RevisionPortSqlite } from './RevisionPortSqlite.js';
import { EntitySubtreeQueryPortSqlite } from './EntitySubtreeQueryPortSqlite.js';

const oldKey = '11'.repeat(32);
const newKey = '22'.repeat(32);
const keyring = `v1=${oldKey},v2=${newKey}`;

function config(enabled: boolean) {
  return { get: vi.fn().mockResolvedValue(enabled) };
}

function seedMetadata(database: SqliteDatabase): void {
  database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['node-type', 'folder', 'Folder']);
  database.run('INSERT INTO node_type_fields (id,node_type_id,field_key,column_name,data_type,encryption_mode) VALUES (?,?,?,?,?,?)', ['node-secret-field', 'node-type', 'secret', 'secret', 'string', 'encrypted']);
  database.run('INSERT INTO entity_types (id,type_key,name,storage_table) VALUES (?,?,?,?)', ['entity-type', 'record', 'Record', 'entity_record']);
  database.run('INSERT INTO entity_type_fields (id,entity_type_id,field_key,column_name,data_type,encryption_mode) VALUES (?,?,?,?,?,?)', ['entity-secret-field', 'entity-type', 'secret', 'secret', 'string', 'encrypted']);
}

describe('SQLite field encryption repository wiring', () => {
  it('protects raw node/entity storage, restores reads, redacts revisions and rotates sidecar ciphertexts', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    seedMetadata(database);
    const service = new FieldEncryptionServiceSqlite(database, config(true) as never, oldKey, keyring, 'v1');
    const nodeRepository = new NodeRepositorySqlite(database, undefined, service);
    const entityRepository = new EntityRepositorySqlite(database, undefined, service);
    const revisionPort = new RevisionPortSqlite(database, service);
    const now = new Date('2026-01-01T00:00:00.000Z');

    const node = new Node('node-1', null, 'node_1', 'node_1', 0, 'node-type', 'Node', '', 1, now, now, null, 'user', 'user', { secret: 'node-secret', public: 'node-public' });
    await nodeRepository.create(node);
    const entity = new Entity('entity-1', 'entity-type', 'node-1', 'Entity', '', 1, now, now, null, 'user', 'user', { secret: 'entity-secret', public: 'entity-public' });
    await entityRepository.create(entity);

    expect(database.get<{ payload: string }>('SELECT payload FROM nodes WHERE id=?', ['node-1'])?.payload).toContain('"secret":null');
    expect(database.get<{ payload: string }>('SELECT payload FROM entities WHERE id=?', ['entity-1'])?.payload).toContain('"secret":null');
    expect(database.all('SELECT 1 FROM resource_field_ciphertexts WHERE ciphertext LIKE ?', ['%node-secret%'])).toEqual([]);
    expect(database.all('SELECT 1 FROM resource_field_ciphertexts WHERE ciphertext LIKE ?', ['%entity-secret%'])).toEqual([]);

    await expect(nodeRepository.findById('node-1')).resolves.toMatchObject({ payload: { secret: 'node-secret', public: 'node-public' } });
    await expect(entityRepository.findById('entity-1')).resolves.toMatchObject({ payload: { secret: 'entity-secret', public: 'entity-public' } });
    await expect(new EntitySubtreeQueryPortSqlite(database, undefined, service).findSubtreeEntitiesPaginated({
      baseNodeId: 'node-1',
      limit: 10,
      actorUserId: 'user',
    })).resolves.toMatchObject({ items: [{ payload: { secret: 'entity-secret', public: 'entity-public' } }] });

    await revisionPort.recordNodeRevision(node, 'created', 'user');
    await revisionPort.recordEntityRevision(entity, 'created', 'user');
    expect(JSON.parse(database.get<{ snapshot_payload: string }>('SELECT snapshot_payload FROM node_revisions WHERE node_id=?', ['node-1'])!.snapshot_payload).payload.secret).toBe('[ENCRYPTED]');
    expect(JSON.parse(database.get<{ snapshot_payload: string }>('SELECT snapshot_payload FROM entity_revisions WHERE entity_id=?', ['entity-1'])!.snapshot_payload).payload.secret).toBe('[ENCRYPTED]');

    const rotated = await new FieldEncryptionServiceSqlite(database, config(true) as never, newKey, keyring, 'v2').rotateBatch(10);
    expect(rotated).toBe(2);
    expect(database.all<{ key_version: string }>('SELECT key_version FROM resource_field_ciphertexts ORDER BY resource_type,resource_id').map((row) => row.key_version)).toEqual(['v2', 'v2']);
    await expect(new NodeRepositorySqlite(database, undefined, new FieldEncryptionServiceSqlite(database, config(true) as never, newKey, keyring, 'v2')).findById('node-1')).resolves.toMatchObject({ payload: { secret: 'node-secret' } });
    database.close();
  });

  it('keeps plaintext storage when the field encryption capability is disabled', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    seedMetadata(database);
    const service = new FieldEncryptionServiceSqlite(database, config(false) as never, oldKey, keyring, 'v1');
    const repository = new EntityRepositorySqlite(database, undefined, service);
    const now = new Date('2026-01-01T00:00:00.000Z');
    database.run('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?)', ['node-1', 'node_1', 'node_1', 0, 'node-type', 'Node', now.toISOString(), now.toISOString(), 1, '{}']);

    await repository.create(new Entity('entity-1', 'entity-type', 'node-1', 'Entity', '', 1, now, now, null, 'user', 'user', { secret: 'entity-secret' }));

    expect(database.get<{ payload: string }>('SELECT payload FROM entities WHERE id=?', ['entity-1'])?.payload).toContain('entity-secret');
    expect(database.all('SELECT 1 FROM resource_field_ciphertexts')).toEqual([]);
    database.close();
  });
});
