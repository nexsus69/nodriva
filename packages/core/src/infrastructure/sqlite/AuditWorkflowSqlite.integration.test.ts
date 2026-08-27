/** Proves the first built-in workflow action writes an auditable canonical record trace. */
import { afterEach, describe, expect, it } from 'vitest';
import { AuditRecordWorkflowActionHandler } from '../../application/services/AuditRecordWorkflowActionHandler.js';
import { WorkflowDefinitionService } from '../../application/services/WorkflowDefinitionService.js';
import { WorkflowEventProcessor } from '../../application/services/WorkflowEventProcessor.js';
import { WorkflowWorker } from '../../application/services/WorkflowWorker.js';
import { AuditPortSqlite } from './AuditPortSqlite.js';
import { AuditQueryPortSqlite } from './AuditQueryPortSqlite.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { TransactionPortSqlite } from './TransactionPortSqlite.js';
import { WorkflowRepositorySqlite } from './WorkflowRepositorySqlite.js';

describe('SQLite audit workflow integration', () => {
  const databases: SqliteDatabase[] = [];
  afterEach(() => { while (databases.length > 0) databases.pop()?.close(); });

  it('converts a persisted record event into one compact audit entry after the worker claims it', async () => {
    const database = new SqliteDatabase();
    databases.push(database);
    ensureSqliteSchema(database);
    const repository = new WorkflowRepositorySqlite(database);
    const definitions = new WorkflowDefinitionService(repository);
    await definitions.saveDefinition({
      workflowId: 'record_history', name: 'Registra cronologia', version: 1, isActive: true,
      triggerEventTypes: ['record.created'], conditions: [],
      steps: [{ stepId: 'audit', actionType: 'audit.record', input: {} }],
    });
    const processor = new WorkflowEventProcessor(new TransactionPortSqlite(database), repository);
    await processor.process({
      eventId: 'record-event-1', eventType: 'record.created', occurredAt: '2026-08-27T12:00:00.000Z',
      subject: { kind: 'node', id: '00000000-0000-0000-0000-000000000001', scopeId: '00000000-0000-0000-0000-000000000002' }, actor: { kind: 'user', id: '00000000-0000-0000-0000-000000000003' },
      payload: { rowVersion: 1, privateValue: 'not audited' }, correlationId: 'session-1', idempotencyKey: 'record-created-node-1',
    });

    const handler = new AuditRecordWorkflowActionHandler(new AuditPortSqlite(database));
    const worker = new WorkflowWorker(repository, { find: (actionType) => actionType === handler.actionType ? handler : null });
    await expect(worker.runOnce('workflow-worker', 10)).resolves.toMatchObject({ claimedCount: 1, failedExecutionKeys: [] });

    const row = database.get<{ action_key: string; resource_kind: string; resource_id: string; node_id: string; after_payload: string }>(
      "SELECT action_key, resource_kind, resource_id, node_id, after_payload FROM audit_logs WHERE action_key='workflow.audit.record'",
    );
    expect(row).toMatchObject({ action_key: 'workflow.audit.record', resource_kind: 'node', resource_id: '00000000-0000-0000-0000-000000000001', node_id: '00000000-0000-0000-0000-000000000002' });
    expect(JSON.parse(row?.after_payload ?? '{}')).toEqual({
      workflowId: 'record_history', workflowVersion: 1, executionKey: 'record_history:1:record-created-node-1:audit',
      eventId: 'record-event-1', eventType: 'record.created', correlationId: 'session-1',
    });
    await expect(new AuditQueryPortSqlite(database).listFilterCatalog()).resolves.toMatchObject({
      actionKeys: expect.arrayContaining(['workflow.audit.record']), resourceKinds: expect.arrayContaining(['node']),
    });
  });
});
