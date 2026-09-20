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

  it('maps database-native backlog statistics to the shared operational contract', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [{
      pending_count: '2', leased_count: '1', retrying_count: '1', oldest_pending_age_seconds: '60', max_attempts: '3',
    }] }) } as unknown as PgExecutor;
    const repository = new WorkflowRepositoryPostgres(executor);
    await expect(repository.getOperationalStats()).resolves.toEqual({
      pendingCount: 2, leasedCount: 1, retryingCount: 1, oldestPendingAgeSeconds: 60, maxAttempts: 3,
    });
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining("COUNT(*) FILTER (WHERE status='pending')"));
  });

  it('bounds workflow catalogue search and ordering in PostgreSQL', async () => {
    const executor = { query: vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ total: '26' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ definition_payload: { workflowId: 'audit', name: 'Audit', version: 2, isActive: true, triggerEventTypes: [], conditions: [], steps: [] }, is_active: true }] }),
    } as unknown as PgExecutor;
    const page = await new WorkflowRepositoryPostgres(executor).listDefinitionsPage({ page: 2, pageSize: 25, search: 'audit', sort: { key: 'version', direction: 'descending' } });
    expect(page).toMatchObject({ total: 26, page: 2, pageCount: 2, items: [{ workflowId: 'audit', version: 2 }] });
    expect(executor.query).toHaveBeenNthCalledWith(2, expect.stringContaining('LIMIT $3 OFFSET $4'), ['audit', '%audit%', 25, 25]);
  });
});
