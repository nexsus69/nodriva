/** Verifies the generic event processor independently from a concrete persistence adapter. */
import { describe, expect, it, vi } from 'vitest';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { WorkflowRepository } from '../ports/WorkflowRepository.js';
import { WorkflowEventProcessor } from './WorkflowEventProcessor.js';

const event = {
  eventId: 'event-1',
  eventType: 'security.scope.revoked',
  occurredAt: '2026-08-27T12:00:00.000Z',
  subject: { kind: 'scope-assignment', id: 'assignment-1' },
  actor: { kind: 'system' as const, id: 'system' },
  payload: { reason: 'coverage-lost' },
  correlationId: 'correlation-1',
  idempotencyKey: 'idempotency-1',
};

function createProcessor(overrides: Partial<WorkflowRepository> = {}) {
  const transactionPort: TransactionPort = {
    runInTransaction: vi.fn(async (work) => work()),
    runInAuthorizationMutation: vi.fn(async (work) => work()),
  };
  const repository: WorkflowRepository = {
    registerEventType: vi.fn(),
    findEventType: vi.fn().mockResolvedValue({ eventType: event.eventType, subjectKinds: ['scope-assignment'], payloadVersion: 1, isActive: true }),
    saveDefinition: vi.fn(),
    findDefinition: vi.fn(),
    listDefinitions: vi.fn(),
    listEventTypes: vi.fn(),
    listActiveDefinitions: vi.fn().mockResolvedValue([{
      workflowId: 'notify-scope-revocation', version: 1, isActive: true,
      triggerEventTypes: [event.eventType], conditions: [],
      steps: [{ stepId: 'notify', actionType: 'notification.create', input: { template: 'scope-revoked' } }],
    }]),
    recordEvent: vi.fn().mockResolvedValue(true),
    recordPlan: vi.fn().mockResolvedValue(true),
    claimPendingSteps: vi.fn(),
    markStepCompleted: vi.fn(),
    markStepFailed: vi.fn(),
    getOperationalStats: vi.fn(),
    ...overrides,
  };
  return { processor: new WorkflowEventProcessor(transactionPort, repository), transactionPort, repository };
}

describe('WorkflowEventProcessor', () => {
  it('persists an accepted event and plans matching workflows inside one transaction', async () => {
    const context = createProcessor();
    await expect(context.processor.process(event)).resolves.toEqual({
      eventRecorded: true,
      plannedInstanceKeys: ['notify-scope-revocation:1:idempotency-1'],
    });
    expect(context.repository.recordEvent).toHaveBeenCalledWith(event);
    expect(context.repository.recordPlan).toHaveBeenCalledWith(expect.objectContaining({
      instanceKey: 'notify-scope-revocation:1:idempotency-1', eventId: event.eventId,
    }));
    expect(context.transactionPort.runInTransaction).toHaveBeenCalledOnce();
  });

  it('does not re-plan a duplicate event after durable idempotency detects it', async () => {
    const context = createProcessor({ recordEvent: vi.fn().mockResolvedValue(false) });
    await expect(context.processor.process(event)).resolves.toEqual({ eventRecorded: false, plannedInstanceKeys: [] });
    expect(context.repository.listActiveDefinitions).not.toHaveBeenCalled();
    expect(context.repository.recordPlan).not.toHaveBeenCalled();
  });

  it('rejects unregistered or incompatible generic event subjects before recording them', async () => {
    const context = createProcessor({
      findEventType: vi.fn().mockResolvedValue({ eventType: event.eventType, subjectKinds: ['different-subject'], payloadVersion: 1, isActive: true }),
    });
    await expect(context.processor.process(event)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED', details: { issues: { subjectKind: expect.any(Array) } },
    });
    expect(context.repository.recordEvent).not.toHaveBeenCalled();
  });
});
