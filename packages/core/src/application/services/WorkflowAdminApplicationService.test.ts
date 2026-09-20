/** Verifies that workflow administration is authorized, version-immutable and auditable. */
import { describe, expect, it, vi } from 'vitest';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { WorkflowRepository } from '../ports/WorkflowRepository.js';
import { WorkflowAdminApplicationService } from './WorkflowAdminApplicationService.js';

function service() {
  const repository: WorkflowRepository = {
    registerEventType: vi.fn(), findEventType: vi.fn().mockResolvedValue({ eventType: 'record.created', subjectKinds: ['node'], payloadVersion: 1, isActive: true }),
    listEventTypes: vi.fn(), saveDefinition: vi.fn().mockResolvedValue(true), findDefinition: vi.fn(), findLatestDefinitionVersion: vi.fn().mockResolvedValue(0), listDefinitions: vi.fn(), listDefinitionsPage: vi.fn(), listActiveDefinitions: vi.fn(),
    recordEvent: vi.fn(), recordPlan: vi.fn(), claimPendingSteps: vi.fn(), markStepCompleted: vi.fn(), markStepFailed: vi.fn(), getOperationalStats: vi.fn(),
  };
  const audit: AuditPort = { record: vi.fn() };
  const transaction: TransactionPort = {
    runInTransaction: vi.fn(async (work) => work()),
    runInAuthorizationMutation: vi.fn(async (work) => work()),
  };
  const access: AccessControlPort = { assertHasPermission: vi.fn(), assertCanCreateNode: vi.fn(), assertCanMoveNode: vi.fn(), assertCanReadNode: vi.fn(), assertCanCreateEntity: vi.fn(), assertCanEditEntity: vi.fn(), assertCanDeleteEntity: vi.fn(), assertCanMoveEntity: vi.fn(), assertHasPermissionCoverage: vi.fn(), assertHasPermissionCoverageBatch: vi.fn(), assertIsSuperAdmin: vi.fn() };
  return { app: new WorkflowAdminApplicationService(repository, audit, transaction, access, new Set(['audit.record'])), repository, audit, access };
}

describe('WorkflowAdminApplicationService', () => {
  it('exposes only installed action types to authorized workflow administration', async () => {
    const context = service();
    await expect(context.app.listActionTypes('admin-1')).resolves.toEqual(['audit.record']);
    expect(context.access.assertHasPermission).toHaveBeenCalledWith('admin-1', 'system.config.read', null);
  });

  it('delegates one bounded workflow window after the read authorization check', async () => {
    const context = service();
    vi.mocked(context.repository.listDefinitionsPage).mockResolvedValue({ items: [], total: 0, page: 1, pageCount: 1 });
    await context.app.listDefinitionsPage('admin-1', { page: 1, pageSize: 25, search: 'audit' });
    expect(context.access.assertHasPermission).toHaveBeenCalledWith('admin-1', 'system.config.read', null);
    expect(context.repository.listDefinitionsPage).toHaveBeenCalledWith({ page: 1, pageSize: 25, search: 'audit' });
  });

  it('derives a next immutable version without loading the workflow catalogue', async () => {
    const context = service();
    vi.mocked(context.repository.findLatestDefinitionVersion).mockResolvedValue(4);
    await expect(context.app.nextDefinitionVersion('admin-1', 'record_history')).resolves.toBe(5);
    expect(context.repository.listDefinitions).not.toHaveBeenCalled();
  });

  it('publishes a new immutable definition only with configuration permission and an audit trace', async () => {
    const context = service();
    await context.app.publishDefinition('admin-1', { workflowId: 'record_history', name: 'Registra cronologia', version: 1, isActive: true, triggerEventTypes: ['record.created'], conditions: [], steps: [{ stepId: 'audit', actionType: 'audit.record', input: {} }] });
    expect(context.access.assertHasPermission).toHaveBeenCalledWith('admin-1', 'system.config', null);
    expect(context.audit.record).toHaveBeenCalledWith('admin-1', 'workflow.publish_definition', 'workflow_definition', 'record_history@1', null, null, expect.objectContaining({ stepActionTypes: ['audit.record'] }), 'Registra cronologia');
  });

  it('rejects an action that is not installed before persisting a retrying workflow', async () => {
    const context = service();
    await expect(context.app.publishDefinition('admin-1', {
      workflowId: 'external', name: 'Azione esterna', version: 1, isActive: true, triggerEventTypes: ['record.created'], conditions: [],
      steps: [{ stepId: 'send', actionType: 'webhook.send', input: {} }],
    })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(context.repository.saveDefinition).not.toHaveBeenCalled();
  });
});
