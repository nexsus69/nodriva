/** Exercises F-03 locks and suspension provenance with separate PostgreSQL clients. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { ResourceRelationshipRepositoryPostgres } from './ResourceRelationshipRepositoryPostgres.js';

const url = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_DATABASE_ADMIN_URL;
const db = url ? new URL(url).pathname.slice(1) : '';
const integration = url && /(?:^|_)test(?:_|$)/.test(db) ? describe : describe.skip;
const typeId = '70000000-0000-0000-0000-000000000001';
const fieldId = '70000000-0000-0000-0000-000000000002';
const sourceA = '70000000-0000-0000-0000-000000000010';
const sourceB = '70000000-0000-0000-0000-000000000011';
const targetA = '70000000-0000-0000-0000-000000000020';
const targetB = '70000000-0000-0000-0000-000000000021';
const batchA = '70000000-0000-0000-0000-000000000030';
const batchB = '70000000-0000-0000-0000-000000000031';

integration('F-03 PostgreSQL concurrency', () => {
  let pool: pg.Pool;
  let concurrentPool: pg.Pool;
  let adminPool: pg.Pool | undefined;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url, max: 4 });
    concurrentPool = new pg.Pool({ connectionString: url, max: 2 });
    adminPool = adminUrl ? new pg.Pool({ connectionString: adminUrl, max: 1 }) : undefined;
    await pool.query('DELETE FROM resource_relationships WHERE source_field_id=$1', [fieldId]);
    await pool.query('DELETE FROM nodes WHERE id = ANY($1::uuid[])', [[sourceA, sourceB, targetA, targetB]]);
    await pool.query('DELETE FROM node_types WHERE id=$1', [typeId]);
    await pool.query("INSERT INTO node_types (id,type_key,name,description) VALUES ($1,'f03-lock','F03 lock','')", [typeId]);
    for (const [id, path] of [[sourceA, 'f03_source_a'], [sourceB, 'f03_source_b'], [targetA, 'f03_target_a'], [targetB, 'f03_target_b']]) {
      await pool.query('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,description,payload) VALUES ($1,$2::ltree,$2,0,$3,$2,\'\',\'{}\')', [id, path, typeId]);
    }
  });
  beforeEach(async () => { await pool.query('DELETE FROM resource_relationships WHERE source_field_id=$1', [fieldId]); });
  afterAll(async () => { await Promise.all([pool?.end(), concurrentPool?.end(), adminPool?.end()]); });

  it('rolls back suspension provenance after a forced failure', async () => {
    await pool.query('INSERT INTO resource_relationships (source_field_id,source_domain,source_resource_id,target_domain,target_resource_id,position,source_cardinality,target_is_unique) VALUES ($1,\'node\',$2,\'node\',$3,0,\'one\',false)', [fieldId, sourceA, targetA]);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const repo = new ResourceRelationshipRepositoryPostgres({ query: client.query.bind(client) } as never);
      try {
        await repo.suspendActiveOutgoingForSources([{ domain: 'node', resourceId: sourceA }], batchA);
        throw new Error('forced failure after edge suspension');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('forced failure after edge suspension');
        await client.query('ROLLBACK');
      }
    } finally { client.release(); }
    const edge = await pool.query('SELECT suspended_at,suspension_deletion_batch_id FROM resource_relationships WHERE source_field_id=$1 AND source_resource_id=$2', [fieldId, sourceA]);
    expect(edge.rows[0]).toMatchObject({ suspended_at: null, suspension_deletion_batch_id: null });
  });

  it('does not deadlock reversed multi-target batches and restores only the matching source', async () => {
    const one = await pool.connect(); const two = await concurrentPool.connect();
    try {
      await Promise.all([one.query("SET lock_timeout='2s'; SET statement_timeout='5s'; BEGIN"), two.query("SET lock_timeout='2s'; SET statement_timeout='5s'; BEGIN")]);
      const first = new ResourceRelationshipRepositoryPostgres({ query: one.query.bind(one) } as never);
      const second = new ResourceRelationshipRepositoryPostgres({ query: two.query.bind(two) } as never);
      const a = first.lockActiveTargets([{ domain: 'node', resourceId: targetB }, { domain: 'node', resourceId: targetA }]);
      await a;
      const waiting = second.lockActiveTargets([{ domain: 'node', resourceId: targetA }, { domain: 'node', resourceId: targetB }]);
      await one.query('COMMIT');
      await expect(waiting).resolves.toBeUndefined();
      await two.query('COMMIT');
    } finally { one.release(); two.release(); }
    await pool.query('INSERT INTO resource_relationships (source_field_id,source_domain,source_resource_id,target_domain,target_resource_id,position,source_cardinality,target_is_unique) VALUES ($1,\'node\',$2,\'node\',$3,0,\'one\',false),($1,\'node\',$4,\'node\',$5,0,\'one\',false)', [fieldId, sourceA, targetA, sourceB, targetB]);
    const repo = new ResourceRelationshipRepositoryPostgres({ query: pool.query.bind(pool) } as never);
    await repo.suspendActiveOutgoingForSources([{ domain: 'node', resourceId: sourceA }], batchA);
    await repo.suspendActiveOutgoingForSources([{ domain: 'node', resourceId: sourceB }], batchB);
    await repo.restoreSuspendedOutgoingForSources([{ domain: 'node', resourceId: sourceA }], batchA);
    const rows = await pool.query('SELECT source_resource_id,suspended_at,suspension_deletion_batch_id FROM resource_relationships WHERE source_field_id=$1 ORDER BY source_resource_id', [fieldId]);
    expect(rows.rows.find((row) => row.source_resource_id === sourceA)?.suspended_at).toBeNull();
    expect(rows.rows.find((row) => row.source_resource_id === sourceB)?.suspension_deletion_batch_id).toBe(batchB);
  });

  it('prevents an edge from being created after a separate delete transaction locks and deletes its target', async () => {
    const deleting = await pool.connect(); const creating = await concurrentPool.connect();
    try {
      await deleting.query("BEGIN; SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='5s'");
      const deleteRepo = new ResourceRelationshipRepositoryPostgres({ query: deleting.query.bind(deleting) } as never);
      await deleteRepo.lockActiveTargets([{ domain: 'node', resourceId: targetA }]);
      await creating.query("BEGIN; SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='5s'");
      const createRepo = new ResourceRelationshipRepositoryPostgres({ query: creating.query.bind(creating) } as never);
      // Attach the rejection handler before releasing the deleting transaction:
      // PostgreSQL is expected to reject only after that commit, but registering
      // it immediately prevents a legitimate concurrent rejection from becoming
      // an unhandled process-level promise rejection under Vitest.
      const creationOutcome = createRepo.assertTargetsActive('node', [targetA])
        .then(async () => {
          await createRepo.replaceValues({ sourceFieldId: fieldId, sourceDomain: 'node', sourceResourceId: sourceA, targetDomain: 'node', targetResourceIds: [targetA], sourceCardinality: 'one', targetIsUnique: false });
          return { created: true as const };
        })
        .catch((error: unknown) => ({ created: false as const, error }));
      await deleting.query('UPDATE nodes SET deleted_at=now() WHERE id=$1', [targetA]);
      await deleting.query('COMMIT');
      const creation = await creationOutcome;
      expect(creation).toMatchObject({ created: false });
      if (creation.created) throw new Error('The concurrent relationship creation unexpectedly succeeded.');
      expect(creation.error).toBeInstanceOf(Error);
      expect((creation.error as Error).message).toBe('Relationship target is deleted or unavailable.');
      await creating.query('ROLLBACK');
      expect((await pool.query('SELECT 1 FROM resource_relationships WHERE source_field_id=$1', [fieldId])).rowCount).toBe(0);
      expect((await pool.query('SELECT deleted_at FROM nodes WHERE id=$1', [targetA])).rows[0]?.deleted_at).not.toBeNull();
    } finally { deleting.release(); creating.release(); }
  });

  it('keeps pre-provenance suspended edges unchanged when migration 042 is reapplied', async () => {
    if (!adminPool) throw new Error('INTEGRATION_DATABASE_ADMIN_URL is required for migration verification');
    await pool.query("INSERT INTO resource_relationships (source_field_id,source_domain,source_resource_id,target_domain,target_resource_id,position,source_cardinality,target_is_unique,suspended_at,suspension_deletion_batch_id) VALUES ($1,'node',$2,'node',$3,0,'one',false,now(),NULL)", [fieldId, sourceB, targetB]);
    const migration = await readFile(fileURLToPath(new URL('../../../../../db/migrations/042_resource_relationship_suspension_provenance.sql', import.meta.url)), 'utf8');
    await adminPool.query(migration);
    await adminPool.query(migration);
    const edge = await pool.query('SELECT suspended_at,suspension_deletion_batch_id FROM resource_relationships WHERE source_field_id=$1 AND source_resource_id=$2', [fieldId, sourceB]);
    expect(edge.rows[0]?.suspended_at).not.toBeNull();
    expect(edge.rows[0]?.suspension_deletion_batch_id).toBeNull();
    const index = await adminPool.query("SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_resource_relationships_suspension_batch'");
    expect(index.rowCount).toBe(1);
  });
});
