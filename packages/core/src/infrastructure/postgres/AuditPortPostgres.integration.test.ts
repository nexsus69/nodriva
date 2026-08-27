/** Verifies the generic textual audit reference contract on the isolated PostgreSQL profile. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { AuditPortPostgres } from './AuditPortPostgres.js';
import { AuditQueryPortPostgres } from './AuditQueryPortPostgres.js';
import { PgExecutor } from './PgExecutor.js';

const applicationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
const adminDatabaseUrl = process.env.INTEGRATION_DATABASE_ADMIN_URL;
const databaseName = applicationDatabaseUrl ? new URL(applicationDatabaseUrl).pathname.slice(1) : '';
const describeIntegration = applicationDatabaseUrl && adminDatabaseUrl && /(?:^|_)test(?:_|$)/.test(databaseName) ? describe : describe.skip;
const actionKey = 'workflow.audit.resource-contract';
const resourceId = 'asset-contract-1';

describeIntegration('PostgreSQL generic audit reference', () => {
  const applicationPool = new pg.Pool({ connectionString: applicationDatabaseUrl });
  const adminPool = new pg.Pool({ connectionString: adminDatabaseUrl });
  const applicationExecutor = new PgExecutor(applicationPool);
  const adminExecutor = new PgExecutor(adminPool);

  beforeEach(async () => {
    await adminExecutor.query('DELETE FROM audit_logs WHERE action_key=$1 AND resource_id=$2', [actionKey, resourceId]);
  });
  afterEach(async () => {
    await adminExecutor.query('DELETE FROM audit_logs WHERE action_key=$1 AND resource_id=$2', [actionKey, resourceId]);
    await applicationPool.end();
    await adminPool.end();
  });

  it('preserves a non-Nodriva subject kind and non-UUID resource identifier', async () => {
    await new AuditPortPostgres(applicationExecutor).record(null, actionKey, 'asset', resourceId, null, null, { source: 'workflow' });
    await expect(new AuditQueryPortPostgres(applicationExecutor).listFilterCatalog()).resolves.toMatchObject({
      actionKeys: expect.arrayContaining([actionKey]), resourceKinds: expect.arrayContaining(['asset']),
    });
    const result = await adminExecutor.query<{ resource_kind: string; resource_id: string; after_payload: { source: string } }>(
      'SELECT resource_kind, resource_id, after_payload FROM audit_logs WHERE action_key=$1 AND resource_id=$2',
      [actionKey, resourceId],
    );
    expect(result.rows).toEqual([{ resource_kind: 'asset', resource_id: resourceId, after_payload: { source: 'workflow' } }]);
  });
});
