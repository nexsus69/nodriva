import { registerWorkflowRepositoryContract } from '../contract/WorkflowRepository.contract.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { WorkflowRepositorySqlite } from './WorkflowRepositorySqlite.js';

registerWorkflowRepositoryContract('SQLite', async () => {
  const database = new SqliteDatabase();
  ensureSqliteSchema(database);
  return {
    repository: new WorkflowRepositorySqlite(database),
    dispose: async () => { database.close(); },
  };
});
