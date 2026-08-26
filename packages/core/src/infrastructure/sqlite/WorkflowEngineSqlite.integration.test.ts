/** Exercises the complete generic workflow engine without Nodriva resource services. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowDefinitionService } from '../../application/services/WorkflowDefinitionService.js';
import { WorkflowEventProcessor } from '../../application/services/WorkflowEventProcessor.js';
import { WorkflowWorker } from '../../application/services/WorkflowWorker.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { TransactionPortSqlite } from './TransactionPortSqlite.js';
import { WorkflowRepositorySqlite } from './WorkflowRepositorySqlite.js';

describe('SQLite generic workflow engine integration', () => {
  const databases: SqliteDatabase[] = [];
  afterEach(() => { while (databases.length > 0) databases.pop()?.close(); });

  it('configures, plans, leases and executes a custom-module event exactly once', async () => {
    const database = new SqliteDatabase();
    databases.push(database);
    ensureSqliteSchema(database);
    const repository = new WorkflowRepositorySqlite(database);
    const definitionService = new WorkflowDefinitionService(repository);
    const transactionPort = new TransactionPortSqlite(database);
    await definitionService.registerEventType({
      eventType: 'custom.asset.calibrated', subjectKinds: ['asset'], payloadVersion: 1, isActive: true,
    });
    await definitionService.saveDefinition({
      workflowId: 'calibration-notification', version: 1, isActive: true,
      triggerEventTypes: ['custom.asset.calibrated'],
      conditions: [{ path: 'payload.result', operator: 'equals', value: 'passed' }],
      steps: [{ stepId: 'notify', actionType: 'notification.create', input: { template: 'calibrated' } }],
    });

    const event = {
      eventId: 'asset-event-1', eventType: 'custom.asset.calibrated', occurredAt: '2026-08-27T12:00:00.000Z',
      subject: { kind: 'asset', id: 'asset-1', typeKey: 'measuring-device' }, actor: { kind: 'integration' as const, id: 'calibration-service' },
      payload: { result: 'passed' }, correlationId: 'calibration-job-1', idempotencyKey: 'calibration-job-1',
    };
    const processor = new WorkflowEventProcessor(transactionPort, repository);
    await expect(processor.process(event)).resolves.toEqual({
      eventRecorded: true, plannedInstanceKeys: ['calibration-notification:1:calibration-job-1'],
    });

    const execute = vi.fn().mockResolvedValue(undefined);
    const worker = new WorkflowWorker(repository, {
      find: (actionType) => actionType === 'notification.create' ? { actionType, execute } : null,
    });
    await expect(worker.runOnce('workflow-worker', 10)).resolves.toEqual({
      claimedCount: 1,
      completedExecutionKeys: ['calibration-notification:1:calibration-job-1:notify'],
      failedExecutionKeys: [],
    });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ subject: { kind: 'asset', id: 'asset-1', typeKey: 'measuring-device' } }),
    }));
    await expect(processor.process(event)).resolves.toEqual({ eventRecorded: false, plannedInstanceKeys: [] });
    await expect(worker.runOnce('workflow-worker', 10)).resolves.toMatchObject({ claimedCount: 0 });
  });
});
