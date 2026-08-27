/** Verifies the built-in workflow audit action without coupling the engine to a subject module. */
import { describe, expect, it, vi } from 'vitest';
import type { AuditPort } from '../ports/AuditPort.js';
import { AuditRecordWorkflowActionHandler } from './AuditRecordWorkflowActionHandler.js';

const execution = {
  executionKey: 'workflow:1:event:audit', instanceKey: 'workflow:1:event', workflowId: 'record-history', workflowVersion: 1,
  event: {
    eventId: 'event', eventType: 'record.created', occurredAt: '2026-08-27T12:00:00.000Z',
    subject: { kind: 'entity', id: '00000000-0000-0000-0000-000000000011', scopeId: '00000000-0000-0000-0000-000000000012' },
    actor: { kind: 'user' as const, id: '00000000-0000-0000-0000-000000000013' }, payload: { sensitive: 'not copied' },
    correlationId: 'session-1', idempotencyKey: 'event-key',
  },
  step: { stepId: 'audit', actionType: 'audit.record', input: {} },
};

describe('AuditRecordWorkflowActionHandler', () => {
  it('writes a compact workflow trace against the original auditable subject', async () => {
    const audit: AuditPort = { record: vi.fn().mockResolvedValue(undefined) };
    await new AuditRecordWorkflowActionHandler(audit).execute(execution);
    expect(audit.record).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000013', 'workflow.audit.record', 'entity', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012', null, {
      workflowId: 'record-history', workflowVersion: 1, executionKey: 'workflow:1:event:audit',
      eventId: 'event', eventType: 'record.created', correlationId: 'session-1',
    });
  });

  it('records arbitrary subject kinds while rejecting unrecognised action input', async () => {
    const audit: AuditPort = { record: vi.fn() };
    const handler = new AuditRecordWorkflowActionHandler(audit);
    await handler.execute({ ...execution, event: { ...execution.event, subject: { kind: 'asset', id: 'asset-1' }, actor: { kind: 'integration', id: 'asset-service' } } });
    expect(audit.record).toHaveBeenCalledWith(null, 'workflow.audit.record', 'asset', 'asset-1', null, null, expect.any(Object));
    vi.mocked(audit.record).mockClear();
    await expect(handler.execute({ ...execution, step: { ...execution.step, input: { actionKey: 'unsafe' } } })).rejects.toThrow('does not accept step input');
    expect(audit.record).not.toHaveBeenCalled();
  });
});
