/** Claims and executes persisted workflow steps after their originating transaction commits. */
import type { WorkflowActionRegistry } from '../ports/WorkflowActionHandler.js';
import type { WorkflowRepository } from '../ports/WorkflowRepository.js';

export interface WorkflowWorkerRunResult {
  claimedCount: number;
  completedExecutionKeys: readonly string[];
  failedExecutionKeys: readonly string[];
}

/**
 * Generic at-least-once step runner. Handlers receive the stable execution key
 * and must use it when an external action supports an idempotency token.
 */
export class WorkflowWorker {
  constructor(
    private readonly repository: WorkflowRepository,
    private readonly actionRegistry: WorkflowActionRegistry,
  ) {}

  async runOnce(workerId: string, limit: number): Promise<WorkflowWorkerRunResult> {
    if (!workerId.trim()) throw new Error('A workflow worker identifier is required.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Workflow worker batch size must be an integer between 1 and 100.');
    }
    const steps = await this.repository.claimPendingSteps(workerId, limit);
    const completedExecutionKeys: string[] = [];
    const failedExecutionKeys: string[] = [];
    for (const step of steps) {
      const handler = this.actionRegistry.find(step.step.actionType);
      try {
        if (!handler) throw new Error(`No workflow action handler is registered for '${step.step.actionType}'.`);
        await handler.execute(step);
        await this.repository.markStepCompleted(step.executionKey, workerId);
        completedExecutionKeys.push(step.executionKey);
      } catch (error: unknown) {
        await this.repository.markStepFailed(step.executionKey, workerId, describeError(error));
        failedExecutionKeys.push(step.executionKey);
      }
    }
    return { claimedCount: steps.length, completedExecutionKeys, failedExecutionKeys };
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
