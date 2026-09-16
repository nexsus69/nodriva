import * as auditActions from '../actions/auditActions';
import * as nodeActions from '../actions/nodeActions';
import * as seedActions from '../actions/seedAction';
import * as securityActions from '../actions/securityActions';
import * as systemActions from '../actions/systemActions';
import * as typeActions from '../actions/typeActions';
import * as recycleActions from '../actions/recycleActions';
import * as entityActions from '../actions/entityActions';
import * as workflowActions from '../actions/workflowActions';
import * as adminContentActions from '../actions/adminContentActions';

type ActionResult = { success: boolean; data?: unknown; error?: unknown };
type MetadataKind = 'node' | 'entity';
type MetadataInvalidator = (kind: MetadataKind, typeKey?: string) => void;

function isFailedActionResult(value: unknown): boolean {
  return Boolean(
    value
    && typeof value === 'object'
    && Reflect.get(value, 'success') === false,
  );
}

/**
 * Coordinator for administrative read models.
 * Components use this facade instead of importing Server Actions directly.
 */
export class AdminCacheClient {
  private readonly reads = new Map<string, Promise<unknown>>();
  /** Keeps only a small working set of administrative result pages per browser session. */
  private readonly pagedReads = new Map<string, Promise<unknown>>();
  private static readonly MAX_PAGED_READS = 5;

  public constructor(
    private readonly onMetadataInvalidated: MetadataInvalidator = () => undefined,
    private readonly verifyCacheHit: () => Promise<boolean> = () => Promise.resolve(true),
  ) {}

  private read<T>(key: string, action: () => Promise<T>): Promise<T> {
    const cached = this.reads.get(key);
    if (cached) {
      return this.verifyCacheHit().then((continuous) => {
        if (continuous && this.reads.get(key) === cached) return cached as Promise<T>;
        if (this.reads.get(key) === cached) this.reads.delete(key);
        return this.read(key, action);
      });
    }
    const request = action()
      .then((result) => {
        if (isFailedActionResult(result) && this.reads.get(key) === request) {
          this.reads.delete(key);
        }
        return result;
      })
      .catch((error) => {
        if (this.reads.get(key) === request) this.reads.delete(key);
        throw error;
      });
    this.reads.set(key, request);
    return request;
  }

  private readPage<T>(key: string, action: () => Promise<T>): Promise<T> {
    const cached = this.pagedReads.get(key);
    if (cached) {
      return this.verifyCacheHit().then((continuous) => {
        if (continuous && this.pagedReads.get(key) === cached) {
          this.pagedReads.delete(key);
          this.pagedReads.set(key, cached);
          return cached as Promise<T>;
        }
        if (this.pagedReads.get(key) === cached) this.pagedReads.delete(key);
        return this.readPage(key, action);
      });
    }
    const request = action().catch((error) => {
      if (this.pagedReads.get(key) === request) this.pagedReads.delete(key);
      throw error;
    });
    this.pagedReads.set(key, request);
    while (this.pagedReads.size > AdminCacheClient.MAX_PAGED_READS) this.pagedReads.delete(this.pagedReads.keys().next().value!);
    return request;
  }

  private write<T extends ActionResult>(keys: string[], action: () => Promise<T>): Promise<T> {
    return action().then((result) => {
      if (result.success) this.invalidate(keys);
      return result;
    });
  }

  private writeMetadata<T extends ActionResult>(kind: MetadataKind, typeKey: string | undefined, keys: string[], action: () => Promise<T>): Promise<T> {
    return this.write(keys, action).then((result) => {
      if (result.success) this.onMetadataInvalidated(kind, typeKey);
      return result;
    });
  }

  public invalidate(keys: string[] = []): void {
    if (keys.length === 0) {
      this.reads.clear();
      this.pagedReads.clear();
      return;
    }
    for (const key of this.reads.keys()) {
      if (keys.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
        this.reads.delete(key);
      }
    }
    for (const key of this.pagedReads.keys()) {
      if (keys.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) this.pagedReads.delete(key);
    }
  }

  public listTypes = (kind: Parameters<typeof typeActions.listTypesAction>[0]) =>
    this.read(`types:${kind}`, () => typeActions.listTypesAction(kind));
  public listTypesPage = (...args: Parameters<typeof typeActions.listTypesPageAction>) =>
    this.readPage(`types-page:${args[0]}:${JSON.stringify(args[1])}`, () => typeActions.listTypesPageAction(...args));
  public getTypeDefinition = (domain: Parameters<typeof typeActions.getTypeDefinitionAction>[0], typeKey: string) =>
    this.read(`type-definition:${domain}:${typeKey}`, () => typeActions.getTypeDefinitionAction(domain, typeKey));
  public getTypeDetail = (kind: Parameters<typeof typeActions.getTypeDetailAction>[0], typeKey: string) =>
    this.read(`type-detail:${kind}:${typeKey}`, () => typeActions.getTypeDetailAction(kind, typeKey));
  public createType = (cmd: Parameters<typeof typeActions.createTypeAction>[0]) =>
    this.writeMetadata(cmd.kind, cmd.typeKey, ['types', 'types-page', 'type-detail', 'type-definition'], () => typeActions.createTypeAction(cmd));
  public updateType = (...args: Parameters<typeof typeActions.updateTypeAction>) =>
    this.writeMetadata(args[0], args[1], ['types', 'type-detail', 'type-definition', 'type-schema-history', 'type-schema-impact'], () => typeActions.updateTypeAction(...args));
  public disableType = (...args: Parameters<typeof typeActions.disableTypeAction>) =>
    this.writeMetadata(args[0], args[1], ['types', 'type-detail', 'type-definition', 'type-schema-history', 'type-schema-impact'], () => typeActions.disableTypeAction(...args));
  public enableType = (...args: Parameters<typeof typeActions.enableTypeAction>) =>
    this.writeMetadata(args[0], args[1], ['types', 'type-detail', 'type-definition', 'type-schema-history', 'type-schema-impact'], () => typeActions.enableTypeAction(...args));
  public createField = (...args: Parameters<typeof typeActions.createFieldAction>) =>
    this.writeMetadata(args[0], args[1], ['types', 'type-detail', 'type-definition', 'type-schema-history', 'type-schema-impact'], () => typeActions.createFieldAction(...args));
  public addEnumOption = (...args: Parameters<typeof typeActions.addEnumOptionAction>) =>
    this.writeMetadata(args[0], args[1], ['types', 'type-detail', 'type-definition', 'type-schema-history', 'type-schema-impact'], () => typeActions.addEnumOptionAction(...args));
  public updateField = (...args: Parameters<typeof typeActions.updateFieldAction>) =>
    this.writeMetadata(args[0], args[1], ['types', 'type-detail', 'type-definition', 'type-schema-history', 'type-schema-impact'], () => typeActions.updateFieldAction(...args));
  public deleteField = (...args: Parameters<typeof typeActions.deleteFieldAction>) =>
    this.writeMetadata(args[0], args[1], ['types', 'type-detail', 'type-definition', 'type-schema-history', 'type-schema-impact'], () => typeActions.deleteFieldAction(...args));
  public listDeletedEntities = (input?: Parameters<typeof recycleActions.listDeletedEntitiesAction>[0]) =>
    this.read(`deleted-entities:${input?.limit ?? 100}:${input?.offset ?? 0}`, () => recycleActions.listDeletedEntitiesAction(input));
  public listDeletedNodes = (input?: Parameters<typeof recycleActions.listDeletedNodesAction>[0]) =>
    this.read(`deleted-nodes:${input?.limit ?? 100}:${input?.offset ?? 0}`, () => recycleActions.listDeletedNodesAction(input));
  public restoreDeletedEntity = (input: Parameters<typeof recycleActions.restoreDeletedEntityAction>[0]) =>
    this.write(['deleted-entities'], () => recycleActions.restoreDeletedEntityAction(input));
  public restoreDeletedNode = (input: Parameters<typeof recycleActions.restoreDeletedNodeAction>[0]) =>
    this.write(['deleted-nodes', 'deleted-entities'], () => recycleActions.restoreDeletedNodeAction(input));
  public purgeDeletedNode = (input: Parameters<typeof recycleActions.purgeDeletedNodeAction>[0]) =>
    this.write(['deleted-nodes', 'deleted-entities'], () => recycleActions.purgeDeletedNodeAction(input));
  public purgeDeletedEntity = (input: Parameters<typeof recycleActions.purgeDeletedEntityAction>[0]) =>
    this.write(['deleted-entities'], () => recycleActions.purgeDeletedEntityAction(input));
  public reorderFields = (...args: Parameters<typeof typeActions.reorderFieldsAction>) =>
    this.writeMetadata(args[0], args[1], ['types', 'type-detail', 'type-definition', 'type-schema-history', 'type-schema-impact'], () => typeActions.reorderFieldsAction(...args));

  public listCapabilities = () => this.read('capabilities', systemActions.listCapabilitiesAction);
  public listServiceConfigurations = () => this.read('service-configurations', systemActions.listServiceConfigurationsAction);
  public checkServiceHealth = (serviceKey: Parameters<typeof systemActions.checkServiceHealthAction>[0]) =>
    this.write(['service-configurations'], () => systemActions.checkServiceHealthAction(serviceKey));
  public getBackupStatus = () => this.read('backup-status', systemActions.getBackupStatusAction);
  public updateCapabilityStatus = (cmd: Parameters<typeof systemActions.updateCapabilityStatusAction>[0]) =>
    this.write(['capabilities'], () => systemActions.updateCapabilityStatusAction(cmd));
  public listSettings = () => this.read('settings', systemActions.listSettingsAction);
  public updateSetting = (cmd: Parameters<typeof systemActions.updateSettingAction>[0]) =>
    this.write(
      cmd.settingKey === 'data.fieldsEncryptionEnabled'
        ? ['settings', 'type-definition', 'type-detail']
        : ['settings'],
      () => systemActions.updateSettingAction(cmd),
    );
  public listPlacementPolicies = () => this.read('placement-policies', systemActions.listPlacementPoliciesAction);
  public getPlacementPolicyByKey = (key: string) =>
    this.read(`placement-policy:${key}`, () => systemActions.getPlacementPolicyByKeyAction(key));
  public createPlacementPolicy = (cmd: Parameters<typeof systemActions.createPlacementPolicyAction>[0]) =>
    this.write(['placement-policies', 'placement-policy'], () => systemActions.createPlacementPolicyAction(cmd));
  public updatePlacementPolicy = (cmd: Parameters<typeof systemActions.updatePlacementPolicyAction>[0]) =>
    this.write(['placement-policies', 'placement-policy'], () => systemActions.updatePlacementPolicyAction(cmd));
  public deletePlacementPolicy = (cmd: Parameters<typeof systemActions.deletePlacementPolicyAction>[0]) =>
    this.write(['placement-policies', 'placement-policy'], () => systemActions.deletePlacementPolicyAction(cmd));
  public createPlacementRule = (cmd: Parameters<typeof systemActions.createPlacementRuleAction>[0]) =>
    this.write(['placement-policy'], () => systemActions.createPlacementRuleAction(cmd));
  public deletePlacementRule = (cmd: Parameters<typeof systemActions.deletePlacementRuleAction>[0]) =>
    this.write(['placement-policy'], () => systemActions.deletePlacementRuleAction(cmd));

  public listWorkflowEventTypes = () => this.read('workflow-event-types', workflowActions.listWorkflowEventTypesAction);
  public listWorkflowActionTypes = () => this.read('workflow-action-types', workflowActions.listWorkflowActionTypesAction);
  public listWorkflowDefinitions = () => this.read('workflow-definitions', workflowActions.listWorkflowDefinitionsAction);
  public publishWorkflowDefinition = (definition: Parameters<typeof workflowActions.publishWorkflowDefinitionAction>[0]) =>
    this.write(['workflow-definitions'], () => workflowActions.publishWorkflowDefinitionAction(definition));

  public listRoles = () => this.read('roles', securityActions.listRolesAction);
  public getRoleByKey = (key: string) => this.read(`role:${key}`, () => securityActions.getRoleByKeyAction(key));
  public createRole = (cmd: Parameters<typeof securityActions.createRoleAction>[0]) =>
    this.write(['roles', 'role'], () => securityActions.createRoleAction(cmd));
  public updateRolePermissions = (cmd: Parameters<typeof securityActions.updateRolePermissionsAction>[0]) =>
    this.write(['roles', 'role'], () => securityActions.updateRolePermissionsAction(cmd));
  public updateRoleMetadata = (cmd: Parameters<typeof securityActions.updateRoleMetadataAction>[0]) =>
    this.write(['roles', 'role'], () => securityActions.updateRoleMetadataAction(cmd));
  public updateRole = (cmd: Parameters<typeof securityActions.updateRoleAction>[0]) =>
    this.write(['roles', 'role'], () => securityActions.updateRoleAction(cmd));
  public listPermissions = () => this.read('permissions', securityActions.listPermissionsAction);
  public listScopeAssignments = () => this.read('scope-assignments', securityActions.listScopeAssignmentsAction);
  public createScopeAssignment = (cmd: Parameters<typeof securityActions.createScopeAssignmentAction>[0]) =>
    this.write(['scope-assignments'], () => securityActions.createScopeAssignmentAction(cmd));
  public deleteScopeAssignment = (cmd: Parameters<typeof securityActions.deleteScopeAssignmentAction>[0]) =>
    this.write(['scope-assignments'], () => securityActions.deleteScopeAssignmentAction(cmd));
  public updateScopeAssignment = (cmd: Parameters<typeof securityActions.updateScopeAssignmentAction>[0]) =>
    this.write(['scope-assignments'], () => securityActions.updateScopeAssignmentAction(cmd));

  public listAuditLogs = (filters: Parameters<typeof auditActions.listAuditLogsAction>[0]) =>
    this.readPage(`audit:${JSON.stringify(filters)}`, () => auditActions.listAuditLogsAction(filters));
  public listAuditFilterCatalog = () => this.read('audit-filter-catalog', auditActions.listAuditFilterCatalogAction);
  public getAuditLogById = (id: string) => this.read(`audit-detail:${id}`, () => auditActions.getAuditLogByIdAction(id));
  public listTypeSchemaHistory = (kind: 'node' | 'entity', typeId: string) =>
    this.read(`type-schema-history:${kind}:${typeId}`, () => auditActions.listTypeSchemaHistoryAction(kind, typeId));
  public getTypeSchemaImpact = (...args: Parameters<typeof typeActions.getTypeSchemaImpactAction>) =>
    this.read(`type-schema-impact:${args.join(':')}`, () => typeActions.getTypeSchemaImpactAction(...args));
  public getTypeSchemaRollbackPlan = (...args: Parameters<typeof typeActions.getTypeSchemaRollbackPlanAction>) =>
    this.read(`type-schema-rollback-plan:${args.join(':')}`, () => typeActions.getTypeSchemaRollbackPlanAction(...args));
  public rollbackTypeMetadata = (...args: Parameters<typeof typeActions.rollbackTypeMetadataAction>) =>
    this.write(['types', 'type-detail', 'type-definition', 'type-schema-history', 'type-schema-rollback-plan'], () => typeActions.rollbackTypeMetadataAction(...args));

  public listChildren = (parentId: string | null) =>
    this.read(`children:${parentId ?? 'root'}`, () => nodeActions.listChildrenAction(parentId));
  public listSubtreeEntities = (input: Parameters<typeof entityActions.listSubtreeEntitiesAction>[0]) =>
    this.read(`subtree-entities:${JSON.stringify(input)}`, () => entityActions.listSubtreeEntitiesAction(input));
  public listAdminNodesPage = (input: Parameters<typeof adminContentActions.listAdminNodesPageAction>[0]) =>
    this.readPage(`admin-nodes-page:${JSON.stringify(input)}`, () => adminContentActions.listAdminNodesPageAction(input));
  public listAdminEntitiesPage = (input: Parameters<typeof adminContentActions.listAdminEntitiesPageAction>[0]) =>
    this.readPage(`admin-entities-page:${JSON.stringify(input)}`, () => adminContentActions.listAdminEntitiesPageAction(input));
  public listNodeTypes = () => this.read('node-types', nodeActions.listNodeTypesAction);

  public checkDatabaseSeeded = () => this.read('seed-status', seedActions.checkDatabaseSeededAction);
  public seedDatabase = (confirmation: string) => this.write(
    ['seed-status', 'children', 'types'],
    () => seedActions.seedDatabaseAction(confirmation),
  );
}
