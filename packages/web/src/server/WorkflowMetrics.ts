/** Formats durable workflow backlog measurements for the protected metrics endpoint. */
import type { WorkflowOperationalStats } from '@dashboard/core';

export function workflowStatsToPrometheus(stats: WorkflowOperationalStats): string {
  return [
    '# TYPE dashboard_workflow_steps_pending gauge',
    `dashboard_workflow_steps_pending ${stats.pendingCount}`,
    '# TYPE dashboard_workflow_steps_leased gauge',
    `dashboard_workflow_steps_leased ${stats.leasedCount}`,
    '# TYPE dashboard_workflow_steps_retrying gauge',
    `dashboard_workflow_steps_retrying ${stats.retryingCount}`,
    '# TYPE dashboard_workflow_steps_oldest_pending_age_seconds gauge',
    `dashboard_workflow_steps_oldest_pending_age_seconds ${stats.oldestPendingAgeSeconds}`,
    '# TYPE dashboard_workflow_steps_max_attempts gauge',
    `dashboard_workflow_steps_max_attempts ${stats.maxAttempts}`,
    '',
  ].join('\n');
}
