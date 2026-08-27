/** Verifies stable Prometheus names for workflow worker operations. */
import { describe, expect, it } from 'vitest';
import { workflowStatsToPrometheus } from './WorkflowMetrics';

describe('workflowStatsToPrometheus', () => {
  it('renders only durable worker backlog values', () => {
    expect(workflowStatsToPrometheus({
      pendingCount: 3, leasedCount: 1, retryingCount: 2, oldestPendingAgeSeconds: 45, maxAttempts: 4,
    })).toContain('dashboard_workflow_steps_retrying 2');
    expect(workflowStatsToPrometheus({
      pendingCount: 3, leasedCount: 1, retryingCount: 2, oldestPendingAgeSeconds: 45, maxAttempts: 4,
    })).toContain('dashboard_workflow_steps_oldest_pending_age_seconds 45');
  });
});
