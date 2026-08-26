/** Verifies validation of generic workflow configuration before persistence. */
import { describe, expect, it, vi } from 'vitest';
import type { WorkflowRepository } from '../ports/WorkflowRepository.js';
import { WorkflowDefinitionService } from './WorkflowDefinitionService.js';

function createService(existing = true) {
  const repository: WorkflowRepository = {
    registerEventType: vi.fn(),
    findEventType: vi.fn().mockResolvedValue(existing ? { eventType: 'custom.invoice.approved', subjectKinds: ['invoice'], payloadVersion: 1, isActive: true } : null),
    saveDefinition: vi.fn(), recordEvent: vi.fn(), recordPlan: vi.fn(), claimPendingSteps: vi.fn(), markStepCompleted: vi.fn(), markStepFailed: vi.fn(),
    listActiveDefinitions: vi.fn(),
  };
  return { service: new WorkflowDefinitionService(repository), repository };
}

describe('WorkflowDefinitionService', () => {
  it('stores a valid generic definition only after every trigger is registered', async () => {
    const context = createService();
    const definition = {
      workflowId: 'invoice-approved', version: 1, isActive: true,
      triggerEventTypes: ['custom.invoice.approved'], conditions: [],
      steps: [{ stepId: 'notify', actionType: 'notification.create', input: { template: 'approved' } }],
    };
    await expect(context.service.saveDefinition(definition)).resolves.toBeUndefined();
    expect(context.repository.saveDefinition).toHaveBeenCalledWith(definition);
  });

  it('rejects malformed definitions and unknown event contracts before persistence', async () => {
    const invalid = createService();
    await expect(invalid.service.saveDefinition({
      workflowId: '', version: 0, isActive: true, triggerEventTypes: [], conditions: [], steps: [],
    })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(invalid.repository.saveDefinition).not.toHaveBeenCalled();

    const unknown = createService(false);
    await expect(unknown.service.saveDefinition({
      workflowId: 'invoice-approved', version: 1, isActive: true,
      triggerEventTypes: ['custom.invoice.approved'], conditions: [],
      steps: [{ stepId: 'notify', actionType: 'notification.create', input: {} }],
    })).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { issues: { triggerEventTypes: expect.any(Array) } } });
    expect(unknown.repository.saveDefinition).not.toHaveBeenCalled();
  });
});
