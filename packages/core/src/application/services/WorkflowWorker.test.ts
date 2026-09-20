/** Verifies that post-commit workflow execution remains generic and retry-safe. */
import { describe, expect, it, vi } from 'vitest';
import type { WorkflowActionRegistry } from '../ports/WorkflowActionHandler.js';
import type { WorkflowRepository } from '../ports/WorkflowRepository.js';
import { WorkflowWorker } from './WorkflowWorker.js';

const step = {
  executionKey: 'workflow:1:event:notify', instanceKey: 'workflow:1:event', workflowId: 'workflow', workflowVersion: 1,
  event: {
    eventId: 'event', eventType: 'custom.document.approved', occurredAt: '2026-08-27T12:00:00.000Z',
    subject: { kind: 'document', id: 'document-1' }, actor: { kind: 'user' as const, id: 'user-1' },
    payload: {}, correlationId: 'correlation', idempotencyKey: 'event-key',
  },
  step: { stepId: 'notify', actionType: 'notification.create', input: { template: 'approved' } },
};

function createWorker(handler: { execute: ReturnType<typeof vi.fn> } | null) {
  const repository: WorkflowRepository = {
    registerEventType: vi.fn(), findEventType: vi.fn(), listEventTypes: vi.fn(), saveDefinition: vi.fn(), findDefinition: vi.fn(), findLatestDefinitionVersion: vi.fn(), listDefinitions: vi.fn(), listDefinitionsPage: vi.fn(), listActiveDefinitions: vi.fn(), recordEvent: vi.fn(), recordPlan: vi.fn(),
    claimPendingSteps: vi.fn().mockResolvedValue([step]), markStepCompleted: vi.fn(), markStepFailed: vi.fn(), getOperationalStats: vi.fn(),
  };
  const registry: WorkflowActionRegistry = {
    find: vi.fn().mockReturnValue(handler ? { actionType: 'notification.create', execute: handler.execute } : null),
  };
  return { worker: new WorkflowWorker(repository, registry), repository, registry };
}

describe('WorkflowWorker', () => {
  it('runs a claimed generic action and completes its durable execution key', async () => {
    const handler = { execute: vi.fn().mockResolvedValue(undefined) };
    const context = createWorker(handler);
    await expect(context.worker.runOnce('worker-1', 20)).resolves.toEqual({
      claimedCount: 1, completedExecutionKeys: [step.executionKey], failedExecutionKeys: [],
    });
    expect(handler.execute).toHaveBeenCalledWith(step);
    expect(context.repository.markStepCompleted).toHaveBeenCalledWith(step.executionKey, 'worker-1');
  });

  it('records an actionable retry when a handler is absent or fails', async () => {
    const context = createWorker(null);
    await expect(context.worker.runOnce('worker-1', 20)).resolves.toEqual({
      claimedCount: 1, completedExecutionKeys: [], failedExecutionKeys: [step.executionKey],
    });
    expect(context.repository.markStepFailed).toHaveBeenCalledWith(
      step.executionKey, 'worker-1', expect.stringContaining('No workflow action handler'),
    );
  });

  it('rejects unsafe worker batch parameters before claiming work', async () => {
    const context = createWorker({ execute: vi.fn() });
    await expect(context.worker.runOnce('', 1)).rejects.toThrow('identifier');
    await expect(context.worker.runOnce('worker-1', 101)).rejects.toThrow('between 1 and 100');
    expect(context.repository.claimPendingSteps).not.toHaveBeenCalled();
  });
});
