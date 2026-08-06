import * as auditActions from '../actions/auditActions';
import * as nodeActions from '../actions/nodeActions';
import * as seedActions from '../actions/seedAction';
import * as securityActions from '../actions/securityActions';
import * as systemActions from '../actions/systemActions';
import * as typeActions from '../actions/typeActions';

type ActionResult = { success: boolean; data?: unknown; error?: unknown };

/**
 * Coordinator for administrative read models.
 * Components use this facade instead of importing Server Actions directly.
 */
export class AdminCacheClient {
  private readonly reads = new Map<string, Promise<unknown>>();

  private read<T>(key: string, action: () => Promise<T>): Promise<T> {
    const cached = this.reads.get(key);
    if (cached) return cached as Promise<T>;
    const request = action().catch((error) => {
      this.reads.delete(key);
      throw error;
    });
    this.reads.set(key, request);
    return request;
  }

  private write<T extends ActionResult>(keys: string[], action: () => Promise<T>): Promise<T> {
    return action().then((result) => {
      if (result.success) this.invalidate(keys);
      return result;
    });
  }

  public invalidate(keys: string[] = []): void {
    if (keys.length === 0) {
      this.reads.clear();
      return;
    }
    for (const key of this.reads.keys()) {
      if (keys.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
        this.reads.delete(key);
      }
    }
  }

  public listTypes = (kind: Parameters<typeof typeActions.listTypesAction>[0]) =>
    this.read(`types:${kind}`, () => typeActions.listTypesAction(kind));
  public getTypeDefinition = (domain: Parameters<typeof typeActions.getTypeDefinitionAction>[0], typeKey: string) =>
    this.read(`type-definition:${domain}:${typeKey}`, () => typeActions.getTypeDefinitionAction(domain, typeKey));
  public getTypeDetail = (kind: Parameters<typeof typeActions.getTypeDetailAction>[0], typeKey: string) =>
    this.read(`type-detail:${kind}:${typeKey}`, () => typeActions.getTypeDetailAction(kind, typeKey));
  public createType = (cmd: Parameters<typeof typeActions.createTypeAction>[0]) =>
    this.write(['types', 'type-detail', 'type-definition'], () => typeActions.createTypeAction(cmd));
  public updateType = (...args: Parameters<typeof typeActions.updateTypeAction>) =>
    this.write(['types', 'type-detail', 'type-definition'], () => typeActions.updateTypeAction(...args));
  public disableType = (...args: Parameters<typeof typeActions.disableTypeAction>) =>
    this.write(['types', 'type-detail', 'type-definition'], () => typeActions.disableTypeAction(...args));
  public createField = (...args: Parameters<typeof typeActions.createFieldAction>) =>
    this.write(['types', 'type-detail', 'type-definition'], () => typeActions.createFieldAction(...args));
  public addEnumOption = (...args: Parameters<typeof typeActions.addEnumOptionAction>) =>
    this.write(['types', 'type-detail', 'type-definition'], () => typeActions.addEnumOptionAction(...args));
  public updateField = (...args: Parameters<typeof typeActions.updateFieldAction>) =>
    this.write(['types', 'type-detail', 'type-definition'], () => typeActions.updateFieldAction(...args));
  public deleteField = (...args: Parameters<typeof typeActions.deleteFieldAction>) =>
    this.write(['types', 'type-detail', 'type-definition'], () => typeActions.deleteFieldAction(...args));
  public reorderFields = (...args: Parameters<typeof typeActions.reorderFieldsAction>) =>
    this.write(['types', 'type-detail', 'type-definition'], () => typeActions.reorderFieldsAction(...args));

  public listCapabilities = () => this.read('capabilities', systemActions.listCapabilitiesAction);
  public updateCapabilityStatus = (cmd: Parameters<typeof systemActions.updateCapabilityStatusAction>[0]) =>
    this.write(['capabilities'], () => systemActions.updateCapabilityStatusAction(cmd));
  public listSettings = () => this.read('settings', systemActions.listSettingsAction);
  public updateSetting = (cmd: Parameters<typeof systemActions.updateSettingAction>[0]) =>
    this.write(['settings'], () => systemActions.updateSettingAction(cmd));
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

  public listRoles = () => this.read('roles', securityActions.listRolesAction);
  public getRoleByKey = (key: string) => this.read(`role:${key}`, () => securityActions.getRoleByKeyAction(key));
  public createRole = (cmd: Parameters<typeof securityActions.createRoleAction>[0]) =>
    this.write(['roles', 'role'], () => securityActions.createRoleAction(cmd));
  public updateRolePermissions = (cmd: Parameters<typeof securityActions.updateRolePermissionsAction>[0]) =>
    this.write(['roles', 'role'], () => securityActions.updateRolePermissionsAction(cmd));
  public listPermissions = () => this.read('permissions', securityActions.listPermissionsAction);
  public listScopeAssignments = () => this.read('scope-assignments', securityActions.listScopeAssignmentsAction);
  public createScopeAssignment = (cmd: Parameters<typeof securityActions.createScopeAssignmentAction>[0]) =>
    this.write(['scope-assignments'], () => securityActions.createScopeAssignmentAction(cmd));
  public deleteScopeAssignment = (cmd: Parameters<typeof securityActions.deleteScopeAssignmentAction>[0]) =>
    this.write(['scope-assignments'], () => securityActions.deleteScopeAssignmentAction(cmd));
  public updateScopeAssignment = (cmd: Parameters<typeof securityActions.updateScopeAssignmentAction>[0]) =>
    this.write(['scope-assignments'], () => securityActions.updateScopeAssignmentAction(cmd));

  public listAuditLogs = (filters: Parameters<typeof auditActions.listAuditLogsAction>[0]) =>
    this.read(`audit:${JSON.stringify(filters)}`, () => auditActions.listAuditLogsAction(filters));
  public getAuditLogById = (id: string) => this.read(`audit-detail:${id}`, () => auditActions.getAuditLogByIdAction(id));

  public listChildren = (parentId: string | null) =>
    this.read(`children:${parentId ?? 'root'}`, () => nodeActions.listChildrenAction(parentId));
  public listNodeTypes = () => this.read('node-types', nodeActions.listNodeTypesAction);

  public checkDatabaseSeeded = () => this.read('seed-status', seedActions.checkDatabaseSeededAction);
  public seedDatabase = (confirmation: string) => this.write(
    ['seed-status', 'children', 'types'],
    () => seedActions.seedDatabaseAction(confirmation),
  );
}
