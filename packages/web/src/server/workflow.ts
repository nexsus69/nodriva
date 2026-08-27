/** Runs registered workflow actions after the originating transaction has committed. */
import { randomUUID } from 'crypto';
import {
  AuditRecordWorkflowActionHandler,
  WorkflowWorker,
} from '@dashboard/core';

const workerId = `${process.env.HOSTNAME ?? 'web'}:${process.pid}:${randomUUID()}`;

/**
 * Drains a bounded workflow batch through the process-local action registry.
 * Durable leasing makes calls from multiple web instances or worker retries
 * safe; each action still receives its stable execution idempotency key.
 */
export async function drainWorkflowSteps(limit = 25) {
  const { auditPort, workflowRepository } = await import('./db');
  const auditRecord = new AuditRecordWorkflowActionHandler(auditPort);
  const worker = new WorkflowWorker(workflowRepository, {
    find(actionType) {
      return actionType === auditRecord.actionType ? auditRecord : null;
    },
  });
  return worker.runOnce(workerId, limit);
}
