import { describe } from 'vitest';
import pg from 'pg';
import { registerWorkflowRepositoryContract } from '../contract/WorkflowRepository.contract.js';
import { PgExecutor } from './PgExecutor.js';
import { WorkflowRepositoryPostgres } from './WorkflowRepositoryPostgres.js';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const describeIntegration = databaseUrl && /(?:^|_)test(?:_|$)/.test(databaseName) ? describe : describe.skip;

describeIntegration('PostgreSQL workflow repository contract', () => {
  registerWorkflowRepositoryContract('PostgreSQL', async () => {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const executor = new PgExecutor(pool);
    await executor.query("DELETE FROM workflow_execution_plans WHERE instance_key LIKE 'workflow-contract-%'");
    await executor.query("DELETE FROM workflow_events WHERE event_id = 'workflow-contract-event'");
    await executor.query("DELETE FROM workflow_definitions WHERE workflow_id LIKE 'workflow-contract-%'");
    await executor.query("DELETE FROM workflow_event_types WHERE event_type = 'security.scope.revoked'");
    return {
      repository: new WorkflowRepositoryPostgres(executor),
      dispose: async () => {
        await executor.query("DELETE FROM workflow_execution_plans WHERE instance_key LIKE 'workflow-contract-%'");
        await executor.query("DELETE FROM workflow_events WHERE event_id = 'workflow-contract-event'");
        await executor.query("DELETE FROM workflow_definitions WHERE workflow_id LIKE 'workflow-contract-%'");
        await executor.query("DELETE FROM workflow_event_types WHERE event_type = 'security.scope.revoked'");
        await pool.end();
      },
    };
  });
});
