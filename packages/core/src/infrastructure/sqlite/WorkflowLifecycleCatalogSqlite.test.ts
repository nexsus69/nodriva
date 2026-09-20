/** Verifies that the standalone profile installs the initial generic lifecycle contracts. */
import { describe, expect, it } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { WorkflowRepositorySqlite } from './WorkflowRepositorySqlite.js';
import { TransactionPortSqlite } from './TransactionPortSqlite.js';
import { WorkflowDefinitionService } from '../../application/services/WorkflowDefinitionService.js';
import { WorkflowEventProcessor } from '../../application/services/WorkflowEventProcessor.js';
import { createUserWorkflowEvent } from '../../application/services/WorkflowEventFactory.js';

describe('SQLite workflow lifecycle catalogue', () => {
  it('registers generic record and hierarchy event types idempotently', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    ensureSqliteSchema(database);
    const repository = new WorkflowRepositorySqlite(database);
    await expect(repository.findEventType('record.created')).resolves.toEqual({
      eventType: 'record.created', subjectKinds: ['node', 'entity'], payloadVersion: 1, isActive: true,
    });
    await expect(repository.findEventType('hierarchy.moved')).resolves.toEqual({
      eventType: 'hierarchy.moved', subjectKinds: ['node'], payloadVersion: 1, isActive: true,
    });
    database.close();
  });

  it('accepts a canonical node producer event without manual event registration', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const repository = new WorkflowRepositorySqlite(database);
    await new WorkflowDefinitionService(repository).saveDefinition({
      workflowId: 'node_created_contract', name: 'Nodo creato', version: 1, isActive: true,
      triggerEventTypes: ['record.created'],
      conditions: [{ path: 'subject.kind', operator: 'equals', value: 'node' }],
      steps: [{ stepId: 'record', actionType: 'audit.record', input: {} }],
    });
    const result = await new WorkflowEventProcessor(new TransactionPortSqlite(database), repository).process(
      createUserWorkflowEvent({
        eventType: 'record.created', subject: { kind: 'node', id: 'node-1' }, actorUserId: 'user-1',
        correlationId: 'session-1', idempotencyKey: 'record.created:node:node-1:1', payload: { rowVersion: 1 },
      }),
    );
    expect(result).toEqual({ eventRecorded: true, plannedInstanceKeys: ['node_created_contract:1:record.created:node:node-1:1'] });
    database.close();
  });

  it('reads a bounded, searched workflow page without materializing the catalogue', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const repository = new WorkflowRepositorySqlite(database);
    for (let index = 1; index <= 26; index += 1) await repository.saveDefinition({ workflowId: `paged_${String(index).padStart(2, '0')}`, name: `Paged ${index}`, version: 1, isActive: true, triggerEventTypes: [], conditions: [], steps: [] });
    await expect(repository.listDefinitionsPage({ page: 2, pageSize: 25, search: 'Paged', sort: { key: 'workflowId', direction: 'ascending' } })).resolves.toMatchObject({ total: 26, page: 2, pageCount: 2, items: [{ workflowId: 'paged_26' }] });
    database.close();
  });
});
