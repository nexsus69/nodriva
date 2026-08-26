/** Verifies PostgreSQL query composition for durable generic workflow persistence. */
import { describe, expect, it, vi } from 'vitest';
import type { PgExecutor } from './PgExecutor.js';
import { WorkflowRepositoryPostgres } from './WorkflowRepositoryPostgres.js';

describe('WorkflowRepositoryPostgres', () => {
  it('persists a plan and its independently leasable step rows', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }) } as unknown as PgExecutor;
    const repository = new WorkflowRepositoryPostgres(executor);
    await expect(repository.recordPlan({
      workflowId: 'workflow', workflowVersion: 1, eventId: 'event', instanceKey: 'workflow:1:event',
      steps: [{ stepId: 'notify', actionType: 'notification.create', input: { channel: 'audit' }, executionKey: 'workflow:1:event:notify' }],
    })).resolves.toBe(true);
    expect(executor.query).toHaveBeenNthCalledWith(1, expect.stringContaining('workflow_execution_plans'), [
      'workflow:1:event', 'workflow', 1, 'event', expect.any(String),
    ]);
    expect(executor.query).toHaveBeenNthCalledWith(2, expect.stringContaining('workflow_execution_steps'), [
      'workflow:1:event:notify', 'workflow:1:event', 'notify', 'notification.create', '{"channel":"audit"}',
    ]);
  });

  it('maps a leased step with its immutable generic event envelope', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [{
      execution_key: 'workflow:1:event:notify', instance_key: 'workflow:1:event', workflow_id: 'workflow', workflow_version: 1,
      event_payload: {
        eventId: 'event', eventType: 'custom.document.approved', occurredAt: '2026-08-27T12:00:00.000Z',
        subject: { kind: 'document', id: 'doc-1' }, actor: { kind: 'system', id: 'system' },
        payload: {}, correlationId: 'correlation', idempotencyKey: 'event-key',
      }, step_id: 'notify', action_type: 'notification.create', input_payload: { channel: 'audit' },
    }] }) } as unknown as PgExecutor;
    const repository = new WorkflowRepositoryPostgres(executor);
    await expect(repository.claimPendingSteps('worker', 1)).resolves.toEqual([
      expect.objectContaining({ executionKey: 'workflow:1:event:notify', event: expect.objectContaining({ eventType: 'custom.document.approved' }) }),
    ]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE SKIP LOCKED'), ['worker', 1]);
  });
});
