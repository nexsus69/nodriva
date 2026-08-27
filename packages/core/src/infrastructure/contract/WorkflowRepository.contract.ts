/** Shared durable-workflow assertions for every persistence adapter. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkflowRepository } from '../../application/ports/WorkflowRepository.js';
import type { WorkflowDefinition, WorkflowEvent } from '../../domain/events/WorkflowEvent.js';

export interface WorkflowRepositoryContractFixture {
  readonly repository: WorkflowRepository;
  dispose(): Promise<void>;
}

const event: WorkflowEvent = {
  eventId: 'workflow-contract-event',
  eventType: 'security.scope.revoked',
  occurredAt: '2026-08-27T10:00:00.000Z',
  subject: { kind: 'scope-assignment', id: 'assignment-1', scopeId: 'node-1' },
  actor: { kind: 'system', id: 'workflow-contract' },
  payload: { reason: 'coverage-lost' },
  correlationId: 'workflow-contract-correlation',
  idempotencyKey: 'workflow-contract-idempotency',
};

const matchingDefinition: WorkflowDefinition = {
  workflowId: 'workflow-contract-alpha',
  version: 1,
  triggerEventTypes: [event.eventType],
  conditions: [],
  steps: [{ stepId: 'notify', actionType: 'notification.create', input: { channel: 'audit' } }],
  isActive: true,
};

/** Proves configuration filtering and idempotency without assuming a resource domain. */
export function registerWorkflowRepositoryContract(
  adapterName: string,
  createFixture: () => Promise<WorkflowRepositoryContractFixture>,
): void {
  describe(`${adapterName} WorkflowRepository contract`, () => {
    let fixture: WorkflowRepositoryContractFixture;

    beforeEach(async () => { fixture = await createFixture(); });
    afterEach(async () => { if (fixture) await fixture.dispose(); });

    it('round-trips the generic event catalogue and only lists matching active definitions', async () => {
      await fixture.repository.registerEventType({
        eventType: event.eventType,
        subjectKinds: ['scope-assignment', 'custom-module-subject'],
        payloadVersion: 1,
        isActive: true,
      });
      await fixture.repository.registerEventType({
        eventType: event.eventType,
        subjectKinds: ['scope-assignment'],
        payloadVersion: 2,
        isActive: false,
      });
      await expect(fixture.repository.findEventType(event.eventType)).resolves.toEqual({
        eventType: event.eventType,
        subjectKinds: ['scope-assignment'],
        payloadVersion: 2,
        isActive: false,
      });

      await expect(fixture.repository.saveDefinition(matchingDefinition)).resolves.toBe(true);
      await expect(fixture.repository.saveDefinition({
        ...matchingDefinition,
        workflowId: 'workflow-contract-beta',
        triggerEventTypes: ['unrelated.event'],
      })).resolves.toBe(true);
      await expect(fixture.repository.saveDefinition({
        ...matchingDefinition,
        workflowId: 'workflow-contract-inactive',
        isActive: false,
      })).resolves.toBe(true);
      await expect(fixture.repository.saveDefinition(matchingDefinition)).resolves.toBe(false);
      const versionTwo = { ...matchingDefinition, version: 2, steps: [{ stepId: 'notify_v2', actionType: 'notification.create', input: { channel: 'audit' } }] };
      await expect(fixture.repository.saveDefinition(versionTwo)).resolves.toBe(true);
      await expect(fixture.repository.findDefinition(matchingDefinition.workflowId, 1)).resolves.toEqual({ ...matchingDefinition, isActive: false });
      await expect(fixture.repository.listActiveDefinitions(event.eventType)).resolves.toEqual([versionTwo]);
    });

    it('records an event and plan exactly once using their stable identifiers', async () => {
      await expect(fixture.repository.recordEvent(event)).resolves.toBe(true);
      await expect(fixture.repository.recordEvent(event)).resolves.toBe(false);
      const plan = {
        workflowId: matchingDefinition.workflowId,
        workflowVersion: matchingDefinition.version,
        eventId: event.eventId,
        instanceKey: 'workflow-contract-alpha:1:workflow-contract-idempotency',
        steps: [{ ...matchingDefinition.steps[0]!, executionKey: 'workflow-contract-alpha:notify' }],
      };
      await expect(fixture.repository.recordPlan(plan)).resolves.toBe(true);
      await expect(fixture.repository.recordPlan(plan)).resolves.toBe(false);
      await expect(fixture.repository.getOperationalStats()).resolves.toMatchObject({
        pendingCount: 1, leasedCount: 0, retryingCount: 0, maxAttempts: 0,
      });
      await expect(fixture.repository.claimPendingSteps('workflow-contract-worker', 1)).resolves.toEqual([
        expect.objectContaining({
          executionKey: 'workflow-contract-alpha:notify',
          event,
          step: expect.objectContaining({ actionType: 'notification.create' }),
        }),
      ]);
      await expect(fixture.repository.getOperationalStats()).resolves.toMatchObject({ pendingCount: 0, leasedCount: 1 });
      await fixture.repository.markStepCompleted('workflow-contract-alpha:notify', 'workflow-contract-worker');
      await expect(fixture.repository.claimPendingSteps('workflow-contract-worker-2', 1)).resolves.toEqual([]);
    });
  });
}
