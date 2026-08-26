/** Defines post-commit action handlers for the generic workflow worker. */
import type { WorkflowExecutionStep } from '../../domain/events/WorkflowEvent.js';

export interface WorkflowActionHandler {
  readonly actionType: string;
  execute(step: WorkflowExecutionStep): Promise<void>;
}

export interface WorkflowActionRegistry {
  find(actionType: string): WorkflowActionHandler | null;
}
