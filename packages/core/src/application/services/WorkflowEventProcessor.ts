/** Atomically validates, records and plans generic workflow events through ports. */
import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import type { WorkflowEvent } from '../../domain/events/WorkflowEvent.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { WorkflowRepository } from '../ports/WorkflowRepository.js';
import { WorkflowPlanner } from './WorkflowPlanner.js';

export interface WorkflowEventProcessingResult {
  eventRecorded: boolean;
  plannedInstanceKeys: readonly string[];
}

/**
 * Turns a registered business event into durable, idempotent workflow plans.
 * It deliberately does not execute actions: workers run only after the
 * surrounding mutation, audit entry and plans have committed.
 */
export class WorkflowEventProcessor {
  constructor(
    private readonly transactionPort: TransactionPort,
    private readonly repository: WorkflowRepository,
    private readonly planner: WorkflowPlanner = new WorkflowPlanner(),
  ) {}

  async process(event: WorkflowEvent): Promise<WorkflowEventProcessingResult> {
    return this.transactionPort.runInTransaction(async () => {
      const eventType = await this.repository.findEventType(event.eventType);
      if (!eventType || !eventType.isActive) {
        throw new ValidationError('Workflow event type is not registered and active.', {
          eventType: [`The event type '${event.eventType}' is unavailable.`],
        });
      }
      if (!eventType.subjectKinds.includes(event.subject.kind)) {
        throw new ValidationError('Workflow event subject kind is not permitted.', {
          subjectKind: [`The subject kind '${event.subject.kind}' is not registered for '${event.eventType}'.`],
        });
      }

      const eventRecorded = await this.repository.recordEvent(event);
      if (!eventRecorded) return { eventRecorded: false, plannedInstanceKeys: [] };

      const definitions = await this.repository.listActiveDefinitions(event.eventType);
      const plannedInstanceKeys: string[] = [];
      for (const definition of definitions) {
        const plan = this.planner.plan(event, definition);
        if (plan && await this.repository.recordPlan(plan)) plannedInstanceKeys.push(plan.instanceKey);
      }
      return { eventRecorded: true, plannedInstanceKeys };
    });
  }
}
