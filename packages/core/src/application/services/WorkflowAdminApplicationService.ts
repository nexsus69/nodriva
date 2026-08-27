/** Secures immutable generic workflow configuration and records its governance history. */
import type { EventTypeDefinition, WorkflowDefinition } from '../../domain/events/WorkflowEvent.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { WorkflowRepository } from '../ports/WorkflowRepository.js';
import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import { WorkflowDefinitionService } from './WorkflowDefinitionService.js';

/** Administrative boundary for workflow catalogue and versioned definition changes. */
export class WorkflowAdminApplicationService {
  private readonly definitions: WorkflowDefinitionService;

  constructor(
    private readonly repository: WorkflowRepository,
    private readonly auditPort: AuditPort,
    private readonly transactionPort: TransactionPort,
    private readonly accessControlPort: AccessControlPort,
    private readonly availableActionTypes: ReadonlySet<string>,
  ) {
    this.definitions = new WorkflowDefinitionService(repository);
  }

  async listEventTypes(actorUserId: string): Promise<EventTypeDefinition[]> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'system.config.read', null);
    return this.repository.listEventTypes();
  }

  async listDefinitions(actorUserId: string): Promise<WorkflowDefinition[]> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'system.config.read', null);
    return this.repository.listDefinitions();
  }

  async registerEventType(actorUserId: string, definition: EventTypeDefinition): Promise<void> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'system.config', null);
    await this.transactionPort.runInTransaction(async () => {
      await this.definitions.registerEventType(definition);
      await this.auditPort.record(actorUserId, 'workflow.register_event_type', 'workflow_event_type', definition.eventType, null, null, {
        subjectKinds: definition.subjectKinds, payloadVersion: definition.payloadVersion, isActive: definition.isActive,
      });
    });
  }

  async publishDefinition(actorUserId: string, definition: WorkflowDefinition): Promise<void> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'system.config', null);
    const unavailableActions = definition.steps
      .map((step) => step.actionType)
      .filter((actionType) => !this.availableActionTypes.has(actionType));
    if (unavailableActions.length > 0) {
      throw new ValidationError('Workflow definition references unavailable action types.', {
        steps: [...new Set(unavailableActions)].map((actionType) => `Action '${actionType}' is not installed.`),
      });
    }
    await this.transactionPort.runInTransaction(async () => {
      await this.definitions.saveDefinition(definition);
      await this.auditPort.record(actorUserId, 'workflow.publish_definition', 'workflow_definition', `${definition.workflowId}@${definition.version}`, null, null, {
        workflowId: definition.workflowId, version: definition.version, triggerEventTypes: definition.triggerEventTypes,
        stepActionTypes: definition.steps.map((step) => step.actionType), isActive: definition.isActive,
      });
    });
  }
}
