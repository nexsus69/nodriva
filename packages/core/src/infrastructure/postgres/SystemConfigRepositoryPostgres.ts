import type { SystemConfigRepository } from '../../application/ports/SystemConfigRepository.js';
import type {
  RuntimeCapabilityDto,
  SystemSettingDto,
  PlacementPolicyListItemDto,
  PlacementPolicyDetailDto,
  CapabilityStatus,
  PolicyMode,
} from '../../application/dto/SystemConfigDtos.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type { PgExecutor } from './PgExecutor.js';

interface CapabilityRow {
  id: string;
  capabilityKey: string;
  name: string;
  description: string | null;
  defaultStatus: CapabilityStatus;
  currentStatus: CapabilityStatus;
  isSystem: boolean;
  updatedAt: Date;
}

interface SettingRow {
  id: string;
  category: string;
  settingKey: string;
  displayName: string;
  description: string | null;
  valueType: SystemSettingDto['valueType'];
  valueText: string | null;
  isSecret: boolean;
  isSystem: boolean;
  rowVersion: number;
  updatedAt: Date;
}

interface PlacementPolicyListRow {
  id: string;
  policyKey: string;
  name: string;
  description: string | null;
  policyMode: PolicyMode;
  rowVersion: number;
  updatedAt: Date;
  ruleCount: number;
}

interface PlacementPolicyRow extends Omit<PlacementPolicyListRow, 'ruleCount'> {}

interface PlacementRuleRow {
  id: string;
  placementPolicyId: string;
  ruleType: string;
  targetNodeId: string | null;
  targetNodeName: string | null;
  targetNodeTypeId: string | null;
  targetNodeTypeName: string | null;
  comparator: string | null;
  valueText: string | null;
  createdAt: Date;
}

export class SystemConfigRepositoryPostgres implements SystemConfigRepository {
  constructor(private readonly executor: PgExecutor) {}

  async listCapabilities(): Promise<RuntimeCapabilityDto[]> {
    const query = `
      SELECT 
        c.id,
        c.capability_key AS "capabilityKey",
        c.name,
        c.description,
        c.default_status AS "defaultStatus",
        COALESCE(o.status::text, c.default_status::text) AS "currentStatus",
        c.is_system AS "isSystem",
        c.updated_at AS "updatedAt"
      FROM runtime_capabilities c
      LEFT JOIN runtime_capability_overrides o ON o.capability_id = c.id AND o.scope_key = 'global'
      ORDER BY c.name ASC
    `;
    const res = await this.executor.query<CapabilityRow>(query);
    return res.rows.map((r) => ({
      id: r.id,
      capabilityKey: r.capabilityKey,
      name: r.name,
      description: r.description ?? '',
      defaultStatus: r.defaultStatus as CapabilityStatus,
      currentStatus: r.currentStatus as CapabilityStatus,
      isSystem: Boolean(r.isSystem),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }

  async updateCapabilityStatus(
    capabilityKey: string,
    status: CapabilityStatus,
    actorUserId: string
  ): Promise<string | null> {
    const capRes = await this.executor.query<{ id: string }>(
      'SELECT id FROM runtime_capabilities WHERE capability_key = $1',
      [capabilityKey]
    );
    if (capRes.rows.length === 0 || !capRes.rows[0]) return null;
    const capabilityId = capRes.rows[0].id;

    const query = `
      INSERT INTO runtime_capability_overrides (id, capability_id, scope_key, status, updated_by, updated_at)
      VALUES (uuid_generate_v7(), $1, 'global', $2::capability_status_enum, $3, NOW())
      ON CONFLICT (capability_id, scope_key)
      DO UPDATE SET status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
    await this.executor.query(query, [capabilityId, status, actorUserId]);
    return capabilityId;
  }

  async listSettings(): Promise<SystemSettingDto[]> {
    const query = `
      SELECT 
        s.id,
        s.category,
        s.setting_key AS "settingKey",
        s.display_name AS "displayName",
        s.description,
        s.value_type AS "valueType",
        s.value_text AS "valueText",
        s.is_secret AS "isSecret",
        s.is_system AS "isSystem",
        s.row_version AS "rowVersion",
        s.updated_at AS "updatedAt"
      FROM system_settings s
      WHERE s.deleted_at IS NULL
      ORDER BY s.category ASC, s.setting_key ASC
    `;
    const res = await this.executor.query<SettingRow>(query);
    return res.rows.map((r) => ({
      id: r.id,
      category: r.category,
      settingKey: r.settingKey,
      displayName: r.displayName,
      description: r.description ?? '',
      valueType: r.valueType,
      valueText: r.valueText ?? null,
      isSecret: Boolean(r.isSecret),
      isSystem: Boolean(r.isSystem),
      rowVersion: Number(r.rowVersion),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }

  async updateSetting(
    settingKey: string,
    valueText: string,
    expectedRowVersion: number,
    actorUserId: string
  ): Promise<string | null> {
    const nextRowVersion = expectedRowVersion + 1;
    const query = `
      UPDATE system_settings
      SET value_text = $1, row_version = $2, updated_by = $3, updated_at = NOW()
      WHERE setting_key = $4 AND row_version = $5 AND deleted_at IS NULL
      RETURNING id
    `;
    const res = await this.executor.query<{ id: string }>(query, [valueText, nextRowVersion, actorUserId, settingKey, expectedRowVersion]);

    if (res.rowCount === 0 || !res.rows[0]) {
      const check = await this.executor.query<{ row_version: number }>(
        'SELECT row_version FROM system_settings WHERE setting_key = $1',
        [settingKey]
      );
      const actual = check.rows[0]?.row_version ?? 0;
      throw new RowVersionMismatchError(expectedRowVersion, actual);
    }

    return res.rows[0].id;
  }

  async listPlacementPolicies(): Promise<PlacementPolicyListItemDto[]> {
    const query = `
      SELECT 
        p.id,
        p.policy_key AS "policyKey",
        p.name,
        p.description,
        p.policy_mode AS "policyMode",
        p.row_version AS "rowVersion",
        p.updated_at AS "updatedAt",
        COUNT(pr.id)::int AS "ruleCount"
      FROM placement_policies p
      LEFT JOIN placement_policy_rules pr ON pr.placement_policy_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY p.name ASC
    `;
    const res = await this.executor.query<PlacementPolicyListRow>(query);
    return res.rows.map((r) => ({
      id: r.id,
      policyKey: r.policyKey,
      name: r.name,
      description: r.description ?? '',
      policyMode: r.policyMode as PolicyMode,
      rowVersion: Number(r.rowVersion),
      ruleCount: Number(r.ruleCount || 0),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }

  async getPlacementPolicyByKey(policyKey: string): Promise<PlacementPolicyDetailDto | null> {
    const pQuery = `
      SELECT id, policy_key AS "policyKey", name, description, policy_mode AS "policyMode", row_version AS "rowVersion", updated_at AS "updatedAt"
      FROM placement_policies
      WHERE policy_key = $1 AND deleted_at IS NULL
    `;
    const pRes = await this.executor.query<PlacementPolicyRow>(pQuery, [policyKey.trim()]);
    if (pRes.rows.length === 0) return null;
    const p = pRes.rows[0];
    if (!p) return null;

    const rQuery = `
      SELECT 
        pr.id,
        pr.placement_policy_id AS "placementPolicyId",
        pr.rule_type AS "ruleType",
        pr.target_node_id AS "targetNodeId",
        n.name AS "targetNodeName",
        pr.target_node_type_id AS "targetNodeTypeId",
        nt.name AS "targetNodeTypeName",
        pr.comparator,
        pr.value_text AS "valueText",
        pr.created_at AS "createdAt"
      FROM placement_policy_rules pr
      LEFT JOIN nodes n ON n.id = pr.target_node_id
      LEFT JOIN node_types nt ON nt.id = pr.target_node_type_id
      WHERE pr.placement_policy_id = $1
      ORDER BY pr.created_at ASC
    `;
    const rRes = await this.executor.query<PlacementRuleRow>(rQuery, [p.id]);

    return {
      id: p.id,
      policyKey: p.policyKey,
      name: p.name,
      description: p.description ?? '',
      policyMode: p.policyMode as PolicyMode,
      rowVersion: Number(p.rowVersion),
      rules: rRes.rows.map((r) => ({
        id: r.id,
        placementPolicyId: r.placementPolicyId,
        ruleType: r.ruleType,
        targetNodeId: r.targetNodeId ?? null,
        targetNodeName: r.targetNodeName ?? null,
        targetNodeTypeId: r.targetNodeTypeId ?? null,
        targetNodeTypeName: r.targetNodeTypeName ?? null,
        comparator: r.comparator ?? null,
        valueText: r.valueText ?? null,
        createdAt: new Date(r.createdAt).toISOString(),
      })),
      updatedAt: new Date(p.updatedAt).toISOString(),
    };
  }

  async findPlacementPolicyByKey(
    policyKey: string
  ): Promise<{ id: string; policyKey: string; name: string; description: string; policyMode: PolicyMode; rowVersion: number } | null> {
    const query = `
      SELECT id, policy_key AS "policyKey", name, description, policy_mode AS "policyMode", row_version AS "rowVersion"
      FROM placement_policies
      WHERE policy_key = $1 AND deleted_at IS NULL
    `;
    const res = await this.executor.query<PlacementPolicyRow>(query, [policyKey.trim()]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      policyKey: r.policyKey,
      name: r.name,
      description: r.description ?? '',
      policyMode: r.policyMode as PolicyMode,
      rowVersion: Number(r.rowVersion),
    };
  }

  async createPlacementPolicy(
    id: string,
    policyKey: string,
    name: string,
    description: string,
    policyMode: PolicyMode
  ): Promise<void> {
    const query = `
      INSERT INTO placement_policies (id, policy_key, name, description, policy_mode, row_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5::policy_mode_enum, 1, NOW(), NOW())
    `;
    await this.executor.query(query, [id, policyKey, name, description, policyMode]);
  }

  async updatePlacementPolicy(
    policyKey: string,
    name: string,
    description: string,
    policyMode: PolicyMode,
    expectedRowVersion: number
  ): Promise<string> {
    const nextRowVersion = expectedRowVersion + 1;
    const query = `
      UPDATE placement_policies
      SET name = $1, description = $2, policy_mode = $3::policy_mode_enum, row_version = $4, updated_at = NOW()
      WHERE policy_key = $5 AND row_version = $6 AND deleted_at IS NULL
      RETURNING id
    `;
    const res = await this.executor.query<{ id: string }>(query, [name, description, policyMode, nextRowVersion, policyKey, expectedRowVersion]);

    if (res.rowCount === 0 || !res.rows[0]) {
      const check = await this.executor.query<{ row_version: number }>(
        'SELECT row_version FROM placement_policies WHERE policy_key = $1 AND deleted_at IS NULL',
        [policyKey]
      );
      const actual = check.rows[0]?.row_version ?? 0;
      throw new RowVersionMismatchError(expectedRowVersion, actual);
    }

    return res.rows[0].id;
  }

  async deletePlacementPolicy(
    policyKey: string,
    expectedRowVersion: number
  ): Promise<string> {
    const nextRowVersion = expectedRowVersion + 1;
    const query = `
      UPDATE placement_policies
      SET deleted_at = NOW(), row_version = $1, updated_at = NOW()
      WHERE policy_key = $2 AND row_version = $3 AND deleted_at IS NULL
      RETURNING id
    `;
    const res = await this.executor.query<{ id: string }>(query, [nextRowVersion, policyKey, expectedRowVersion]);

    if (res.rowCount === 0 || !res.rows[0]) {
      const check = await this.executor.query<{ row_version: number }>(
        'SELECT row_version FROM placement_policies WHERE policy_key = $1 AND deleted_at IS NULL',
        [policyKey]
      );
      const actual = check.rows[0]?.row_version ?? 0;
      throw new RowVersionMismatchError(expectedRowVersion, actual);
    }

    return res.rows[0].id;
  }

  async createPlacementRule(
    id: string,
    placementPolicyId: string,
    ruleType: string,
    targetNodeId: string | null,
    targetNodeTypeId: string | null,
    comparator: string | null,
    valueText: string | null
  ): Promise<void> {
    const query = `
      INSERT INTO placement_policy_rules (id, placement_policy_id, rule_type, target_node_id, target_node_type_id, comparator, value_text, created_at)
      VALUES ($1, $2, $3::rule_type_enum, $4, $5, $6, $7, NOW())
    `;
    await this.executor.query(query, [id, placementPolicyId, ruleType, targetNodeId, targetNodeTypeId, comparator, valueText]);
  }

  async deletePlacementRule(ruleId: string): Promise<void> {
    await this.executor.query('DELETE FROM placement_policy_rules WHERE id = $1', [ruleId]);
  }
}
