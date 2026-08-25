import { afterAll, beforeAll, describe } from 'vitest';
import pg from 'pg';
import { resourceRelationshipRepositoryContract } from '../ResourceRelationshipRepository.contract.js';
import { PgExecutor } from './PgExecutor.js';
import { ResourceRelationshipRepositoryPostgres } from './ResourceRelationshipRepositoryPostgres.js';

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
const integrationDatabaseName = integrationDatabaseUrl
  ? new URL(integrationDatabaseUrl).pathname.slice(1)
  : '';
const describeIntegration = integrationDatabaseUrl && /(?:^|_)test(?:_|$)/.test(integrationDatabaseName)
  ? describe
  : describe.skip;
const contractFieldId = '11111111-1111-4111-8111-111111111111';

/** Runs the persistence contract only against the explicitly configured test database. */
describeIntegration('ResourceRelationshipRepositoryPostgres integration', () => {
  let pool: pg.Pool;
  let executor: PgExecutor;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: integrationDatabaseUrl });
    executor = new PgExecutor(pool);
    await executor.query('SELECT 1 FROM resource_relationships LIMIT 1');
    await executor.query('DELETE FROM resource_relationships WHERE source_field_id = $1', [contractFieldId]);
  });

  afterAll(async () => {
    if (executor) {
      await executor.query('DELETE FROM resource_relationships WHERE source_field_id = $1', [contractFieldId]);
    }
    await pool?.end();
  });

  resourceRelationshipRepositoryContract('PostgreSQL', async () => (
    new ResourceRelationshipRepositoryPostgres(executor)
  ));
});
