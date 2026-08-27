/** Records a safe, traceable workflow completion through the existing audit port. */
import type { WorkflowActionHandler } from '../ports/WorkflowActionHandler.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { WorkflowExecutionStep } from '../../domain/events/WorkflowEvent.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Built-in action bridge for the Nodriva audit log.
 *
 * The workflow engine and this sink accept every subject kind. It intentionally
 * stores only envelope metadata, never the workflow event's dynamic payload.
 */
export class AuditRecordWorkflowActionHandler implements WorkflowActionHandler {
  readonly actionType = 'audit.record';

  constructor(private readonly auditPort: AuditPort) {}

  async execute(execution: WorkflowExecutionStep): Promise<void> {
    const { event, executionKey, workflowId, workflowVersion } = execution;
    if (Object.keys(execution.step.input).length > 0) {
      throw new Error('The audit.record action does not accept step input.');
    }

    await this.auditPort.record(
      event.actor.kind === 'user' && UUID_PATTERN.test(event.actor.id) ? event.actor.id : null,
      'workflow.audit.record',
      event.subject.kind,
      event.subject.id,
      this.nodeScopeId(event.subject.kind, event.subject.scopeId),
      null,
      {
        workflowId,
        workflowVersion,
        executionKey,
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
      },
    );
  }

  private nodeScopeId(subjectKind: string, scopeId: string | null | undefined): string | null {
    return (subjectKind === 'node' || subjectKind === 'entity') && scopeId && UUID_PATTERN.test(scopeId)
      ? scopeId
      : null;
  }
}
