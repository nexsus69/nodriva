import type { SystemConfigRepository } from '../../application/ports/SystemConfigRepository.js';
import type { CapabilityStatus, PlacementPolicyDetailDto, PlacementPolicyListItemDto, RuntimeCapabilityDto, SystemSettingDto, PolicyMode } from '../../application/dto/SystemConfigDtos.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface CapabilityRow extends Omit<RuntimeCapabilityDto, 'isSystem' | 'updatedAt'> { isSystem: number; updatedAt: string; }
interface SettingRow extends Omit<SystemSettingDto, 'isSecret' | 'isSystem' | 'rowVersion' | 'updatedAt'> { isSecret: number; isSystem: number; rowVersion: number; updatedAt: string; }
interface PolicyRow { id: string; policy_key: string; name: string; description: string; policy_mode: PolicyMode; row_version: number; ruleCount?: number; updated_at: string; }
interface RuleRow { id: string; placementPolicyId: string; ruleType: string; targetNodeId: string | null; targetNodeName: string | null; targetNodeTypeId: string | null; targetNodeTypeName: string | null; comparator: string | null; valueText: string | null; createdAt: string; }

export class SystemConfigRepositorySqlite implements SystemConfigRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async listCapabilities(): Promise<RuntimeCapabilityDto[]> {
    return this.database.all<CapabilityRow>(`SELECT c.capability_key AS capabilityKey,c.capability_key AS id,COALESCE(m.name,c.capability_key) AS name,COALESCE(m.description,'') AS description,c.default_status AS defaultStatus,COALESCE(o.status,c.default_status) AS currentStatus,COALESCE(m.is_system,0) AS isSystem,COALESCE(m.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS updatedAt FROM runtime_capabilities c LEFT JOIN runtime_capability_metadata m ON m.capability_key=c.capability_key LEFT JOIN runtime_capability_overrides o ON o.capability_key=c.capability_key AND o.scope_key='global' ORDER BY name`).map((row) => ({ ...row, isSystem: row.isSystem === 1, updatedAt: new Date(row.updatedAt).toISOString() }));
  }
  async updateCapabilityStatus(key: string, status: CapabilityStatus): Promise<string | null> {
    if (!this.database.get<{ capability_key: string }>('SELECT capability_key FROM runtime_capabilities WHERE capability_key=?', [key])) return null;
    this.database.run('INSERT INTO runtime_capability_overrides(capability_key,scope_key,status) VALUES(?,?,?) ON CONFLICT(capability_key,scope_key) DO UPDATE SET status=excluded.status', [key, 'global', status]);
    return key;
  }
  async listSettings(): Promise<SystemSettingDto[]> {
    return this.database.all<SettingRow>(`SELECT setting_key AS settingKey,setting_key AS id,'system' AS category,setting_key AS displayName,'' AS description,value_type AS valueType,value_text AS valueText,0 AS isSecret,0 AS isSystem,row_version AS rowVersion,updated_at AS updatedAt FROM system_settings WHERE deleted_at IS NULL ORDER BY setting_key`).map((row) => ({ ...row, isSecret: false, isSystem: false, rowVersion: Number(row.rowVersion), updatedAt: new Date(row.updatedAt).toISOString() }));
  }
  async updateSetting(key: string, value: string, expected: number): Promise<string | null> {
    const result = this.database.run(`UPDATE system_settings SET value_text=?,row_version=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE setting_key=? AND row_version=? AND deleted_at IS NULL`, [value, expected + 1, key, expected]);
    if (result.changes) return key;
    const current = this.database.get<{ row_version: number }>('SELECT row_version FROM system_settings WHERE setting_key=?', [key]);
    throw new RowVersionMismatchError(expected, Number(current?.row_version ?? 0));
  }
  async listPlacementPolicies(): Promise<PlacementPolicyListItemDto[]> { return this.database.all<PolicyRow>(`SELECT p.*,COUNT(r.id) AS ruleCount FROM placement_policies p LEFT JOIN placement_policy_rules r ON r.placement_policy_id=p.id WHERE p.deleted_at IS NULL GROUP BY p.id ORDER BY p.name`).map((row) => this.policyList(row)); }
  async getPlacementPolicyByKey(key: string): Promise<PlacementPolicyDetailDto | null> {
    const policy = this.database.get<PolicyRow>('SELECT * FROM placement_policies WHERE policy_key=? AND deleted_at IS NULL', [key.trim()]);
    if (!policy) return null;
    const rules = this.database.all<RuleRow>(`SELECT r.id,r.placement_policy_id AS placementPolicyId,r.rule_type AS ruleType,r.target_node_id AS targetNodeId,n.name AS targetNodeName,r.target_node_type_id AS targetNodeTypeId,nt.name AS targetNodeTypeName,r.comparator,r.value_text AS valueText,r.created_at AS createdAt FROM placement_policy_rules r LEFT JOIN nodes n ON n.id=r.target_node_id LEFT JOIN node_types nt ON nt.id=r.target_node_type_id WHERE r.placement_policy_id=? ORDER BY r.created_at`, [policy.id]).map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }));
    return { ...this.policyList(policy), rules };
  }
  async findPlacementPolicyByKey(key: string) { const row = this.database.get<PolicyRow>('SELECT * FROM placement_policies WHERE policy_key=? AND deleted_at IS NULL', [key.trim()]); return row ? { id: row.id, policyKey: row.policy_key, name: row.name, description: row.description, policyMode: row.policy_mode, rowVersion: Number(row.row_version) } : null; }
  async createPlacementPolicy(id: string, key: string, name: string, description: string, mode: PolicyMode): Promise<void> { this.database.run('INSERT INTO placement_policies(id,policy_key,name,description,policy_mode) VALUES(?,?,?,?,?)', [id, key, name, description, mode]); }
  async updatePlacementPolicy(key: string, name: string, description: string, mode: PolicyMode, expected: number): Promise<string> { return this.updatePolicy('UPDATE placement_policies SET name=?,description=?,policy_mode=?,row_version=?,updated_at=strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') WHERE policy_key=? AND row_version=? AND deleted_at IS NULL', [name, description, mode, expected + 1, key, expected], key, expected); }
  async deletePlacementPolicy(key: string, expected: number): Promise<string> { return this.updatePolicy('UPDATE placement_policies SET deleted_at=strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\'),row_version=?,updated_at=strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') WHERE policy_key=? AND row_version=? AND deleted_at IS NULL', [expected + 1, key, expected], key, expected); }
  async createPlacementRule(id: string, policyId: string, type: string, nodeId: string | null, nodeTypeId: string | null, comparator: string | null, value: string | null): Promise<void> { this.database.run('INSERT INTO placement_policy_rules(id,placement_policy_id,rule_type,target_node_id,target_node_type_id,comparator,value_text) VALUES(?,?,?,?,?,?,?)', [id, policyId, type, nodeId, nodeTypeId, comparator, value]); }
  async deletePlacementRule(id: string): Promise<void> { this.database.run('DELETE FROM placement_policy_rules WHERE id=?', [id]); }
  private updatePolicy(sql: string, values: readonly unknown[], key: string, expected: number): string { if (this.database.run(sql, values).changes) { const row = this.database.get<{ id: string }>('SELECT id FROM placement_policies WHERE policy_key=?', [key]); if (row) return row.id; } const current = this.database.get<{ row_version: number }>('SELECT row_version FROM placement_policies WHERE policy_key=?', [key]); throw new RowVersionMismatchError(expected, Number(current?.row_version ?? 0)); }
  private policyList(row: PolicyRow): PlacementPolicyListItemDto { return { id: row.id, policyKey: row.policy_key, name: row.name, description: row.description, policyMode: row.policy_mode, rowVersion: Number(row.row_version), ruleCount: Number(row.ruleCount ?? 0), updatedAt: new Date(row.updated_at).toISOString() }; }
}
