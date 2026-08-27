/** Verifies the generic textual audit reference contract on the isolated PostgreSQL profile. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { AuditPortPostgres } from './AuditPortPostgres.js';
import { PgExecutor } from './PgExecutor.js';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const describeIntegration = databaseUrl && /(?:^|_)test(?:_|$)/.test(databaseName) ? describe : describe.skip;
const actionKey = 'workflow.audit.resource-contract';
const resourceId = 'asset-contract-1';

describeIntegration('PostgreSQL generic audit reference', () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const executor = new PgExecutor(pool);

  beforeEach(async () => {
    await executor.query('DELETE FROM audit_logs WHERE action_key=$1 AND resource_id=$2', [actionKey, resourceId]);
  });
  afterEach(async () => {
    await executor.query('DELETE FROM audit_logs WHERE action_key=$1 AND resource_id=$2', [actionKey, resourceId]);
    await pool.end();
  });

  it('preserves a non-Nodriva subject kind and non-UUID resource identifier', async () => {
    await new AuditPortPostgres(executor).record(null, actionKey, 'asset', resourceId, null, null, { source: 'workflow' });
    const result = await executor.query<{ resource_kind: string; resource_id: string; after_payload: { source: string } }>(
      'SELECT resource_kind, resource_id, after_payload FROM audit_logs WHERE action_key=$1 AND resource_id=$2',
      [actionKey, resourceId],
    );
    expect(result.rows).toEqual([{ resource_kind: 'asset', resource_id: resourceId, after_payload: { source: 'workflow' } }]);
  });
});
