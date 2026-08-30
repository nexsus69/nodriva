/** Verifies the generic textual audit reference contract on the isolated PostgreSQL profile. */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { PolicyAuditRecorder } from '../../application/services/PolicyAuditRecorder.js';
import { RealtimeAuditCollectionInvalidator } from '../../application/services/RealtimeAuditCollectionInvalidator.js';
import type { RuntimeConfigurationPort } from '../../application/ports/RuntimeConfigurationPort.js';
import { AuditPortPostgres } from './AuditPortPostgres.js';
import { AuditQueryPortPostgres } from './AuditQueryPortPostgres.js';
import { PgExecutor } from './PgExecutor.js';
import { RealtimeOutboxPostgres } from './RealtimeOutboxPostgres.js';
import { TransactionPortPostgres } from './TransactionPortPostgres.js';

const applicationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
const adminDatabaseUrl = process.env.INTEGRATION_DATABASE_ADMIN_URL;
const databaseName = applicationDatabaseUrl ? new URL(applicationDatabaseUrl).pathname.slice(1) : '';
const describeIntegration = applicationDatabaseUrl && adminDatabaseUrl && /(?:^|_)test(?:_|$)/.test(databaseName) ? describe : describe.skip;
const actionKey = 'workflow.audit.resource-contract';
const resourceId = 'asset-contract-1';
const auditEventId = '00000000-0000-4000-8000-000000000711';

describeIntegration('PostgreSQL generic audit reference', () => {
  const applicationPool = new pg.Pool({ connectionString: applicationDatabaseUrl });
  const adminPool = new pg.Pool({ connectionString: adminDatabaseUrl });
  const applicationExecutor = new PgExecutor(applicationPool);
  const adminExecutor = new PgExecutor(adminPool);

  beforeEach(async () => {
    await adminExecutor.query('DELETE FROM audit_logs WHERE action_key=$1 AND resource_id=$2', [actionKey, resourceId]);
    await adminExecutor.query('DELETE FROM realtime_event_outbox WHERE event_id=$1', [auditEventId]);
  });
  afterEach(async () => {
    await adminExecutor.query('DELETE FROM audit_logs WHERE action_key=$1 AND resource_id=$2', [actionKey, resourceId]);
    await adminExecutor.query('DELETE FROM realtime_event_outbox WHERE event_id=$1', [auditEventId]);
  });
  afterAll(async () => {
    await applicationPool.end();
    await adminPool.end();
  });

  it('preserves a non-Nodriva subject kind and non-UUID resource identifier', async () => {
    await new AuditPortPostgres(applicationExecutor).record(null, actionKey, 'asset', resourceId, null, null, { source: 'workflow' }, 'Workflow asset');
    await expect(new AuditQueryPortPostgres(applicationExecutor).listFilterCatalog()).resolves.toMatchObject({
      actionKeys: expect.arrayContaining([actionKey]), resourceKinds: expect.arrayContaining(['asset']),
    });
    const result = await adminExecutor.query<{ resource_kind: string; resource_id: string; resource_label: string; after_payload: { source: string } }>(
      'SELECT resource_kind, resource_id, resource_label, after_payload FROM audit_logs WHERE action_key=$1 AND resource_id=$2',
      [actionKey, resourceId],
    );
    expect(result.rows).toEqual([{ resource_kind: 'asset', resource_id: resourceId, resource_label: 'Workflow asset', after_payload: { source: 'workflow' } }]);
  });

  it('commits audit evidence and its collection invalidation in one PostgreSQL transaction', async () => {
    const recorder = new PolicyAuditRecorder(
      new AuditPortPostgres(applicationExecutor),
      { shouldRecord: async () => true },
      new TransactionPortPostgres(applicationPool),
      new RealtimeAuditCollectionInvalidator(
        new RealtimeOutboxPostgres(applicationExecutor),
        {
          isCapabilityEnabled: async () => true,
          getSetting: async <T>(_key: string, defaultValue: T): Promise<T> => defaultValue,
        } satisfies RuntimeConfigurationPort,
        { generate: () => auditEventId },
        () => new Date('2026-08-30T12:00:00.000Z'),
      ),
    );

    await recorder.record(null, actionKey, 'asset', resourceId, null, null, { source: 'workflow' });

    await expect(adminExecutor.query('SELECT 1 FROM audit_logs WHERE action_key=$1 AND resource_id=$2', [actionKey, resourceId]))
      .resolves.toMatchObject({ rowCount: 1 });
    const outbox = await adminExecutor.query<{ event_payload: { resourceType: string; resourceId: string } }>(
      'SELECT event_payload FROM realtime_event_outbox WHERE event_id=$1', [auditEventId],
    );
    expect(outbox.rows[0]?.event_payload).toMatchObject({ resourceType: 'audit', resourceId: `asset:${resourceId}` });
  });

  it('rolls back audit evidence when audit invalidation cannot enter the outbox', async () => {
    const recorder = new PolicyAuditRecorder(
      new AuditPortPostgres(applicationExecutor),
      { shouldRecord: async () => true },
      new TransactionPortPostgres(applicationPool),
      { invalidatePersistedAudit: async () => { throw new Error('outbox unavailable'); } },
    );

    await expect(recorder.record(null, actionKey, 'asset', resourceId, null, null, { source: 'workflow' }))
      .rejects.toThrow('outbox unavailable');
    await expect(adminExecutor.query('SELECT 1 FROM audit_logs WHERE action_key=$1 AND resource_id=$2', [actionKey, resourceId]))
      .resolves.toMatchObject({ rowCount: 0 });
  });
});
