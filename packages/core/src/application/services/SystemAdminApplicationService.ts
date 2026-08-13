import type { SystemConfigRepository } from '../ports/SystemConfigRepository.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type {
  RuntimeCapabilityDto,
  SystemSettingDto,
  PlacementPolicyListItemDto,
  PlacementPolicyDetailDto,
} from '../dto/SystemConfigDtos.js';
import type {
  UpdateCapabilityStatusCommand,
  UpdateSystemSettingCommand,
  CreatePlacementPolicyCommand,
  UpdatePlacementPolicyCommand,
  DeletePlacementPolicyCommand,
  CreatePlacementRuleCommand,
  DeletePlacementRuleCommand} from '../commands/SystemConfigCommands.js';
import { UpdateCapabilityStatusCommandSchema, UpdateSystemSettingCommandSchema, CreatePlacementPolicyCommandSchema, UpdatePlacementPolicyCommandSchema, DeletePlacementPolicyCommandSchema, CreatePlacementRuleCommandSchema, DeletePlacementRuleCommandSchema,
} from '../commands/SystemConfigCommands.js';
import {
  PlacementPolicyNotFoundError,
  PlacementPolicyKeyAlreadyExistsError,
  SystemConfigValidationError,
} from '../../domain/errors/SystemAdminErrors.js';
import type { z } from 'zod';

export class SystemAdminApplicationService {
  constructor(
    private readonly systemConfigRepository: SystemConfigRepository,
    private readonly auditPort: AuditPort,
    private readonly transactionPort: TransactionPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly accessControlPort: AccessControlPort
  ) {}

  async listCapabilities(actorUserId: string): Promise<RuntimeCapabilityDto[]> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'system.config.read', null);
    return await this.systemConfigRepository.listCapabilities();
  }

  async updateCapabilityStatus(cmd: UpdateCapabilityStatusCommand): Promise<void> {
    const v = this.validateCommand(UpdateCapabilityStatusCommandSchema, cmd, 'updating capability status');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'system.config', null);

    return await this.transactionPort.runInTransaction(async () => {
      const capabilityId = await this.systemConfigRepository.updateCapabilityStatus(v.capabilityKey, v.status, v.actorUserId);
      if (capabilityId) {
        await this.auditPort.record(
          v.actorUserId,
          'system.update_capability',
          'runtime_capability',
          capabilityId,
          null,
          null,
          { capabilityKey: v.capabilityKey, status: v.status }
        );
      }
    });
  }

  async listSettings(actorUserId: string): Promise<SystemSettingDto[]> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'system.config.read', null);
    return await this.systemConfigRepository.listSettings();
  }

  async updateSetting(cmd: UpdateSystemSettingCommand): Promise<void> {
    const v = this.validateCommand(UpdateSystemSettingCommandSchema, cmd, 'updating system setting');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'system.config', null);

    return await this.transactionPort.runInTransaction(async () => {
      const settingId = await this.systemConfigRepository.updateSetting(
        v.settingKey,
        v.settingValueText,
        v.expectedRowVersion,
        v.actorUserId
      );
      if (settingId) {
        await this.auditPort.record(
          v.actorUserId,
          'system.update_setting',
          'system_setting',
          settingId,
          null,
          null,
          { settingKey: v.settingKey, valueText: v.settingValueText }
        );
      }
    });
  }

  async listPlacementPolicies(actorUserId: string): Promise<PlacementPolicyListItemDto[]> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'system.config.read', null);
    return await this.systemConfigRepository.listPlacementPolicies();
  }

  async getPlacementPolicyByKey(actorUserId: string, policyKey: string): Promise<PlacementPolicyDetailDto | null> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'system.config.read', null);
    return await this.systemConfigRepository.getPlacementPolicyByKey(policyKey);
  }

  async createPlacementPolicy(cmd: CreatePlacementPolicyCommand): Promise<PlacementPolicyDetailDto> {
    const v = this.validateCommand(CreatePlacementPolicyCommandSchema, cmd, 'creating placement policy');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'system.config', null);

    return await this.transactionPort.runInTransaction(async () => {
      const existing = await this.systemConfigRepository.findPlacementPolicyByKey(v.policyKey);
      if (existing) {
        throw new PlacementPolicyKeyAlreadyExistsError(v.policyKey);
      }

      const policyId = this.idGenerator.generate();
      await this.systemConfigRepository.createPlacementPolicy(
        policyId,
        v.policyKey,
        v.name,
        v.description ?? '',
        v.policyMode
      );

      await this.auditPort.record(
        v.actorUserId,
        'system.create_placement_policy',
        'placement_policy',
        policyId,
        null,
        null,
        { policyKey: v.policyKey, name: v.name, policyMode: v.policyMode }
      );

      const created = await this.systemConfigRepository.getPlacementPolicyByKey(v.policyKey);
      if (!created) throw new PlacementPolicyNotFoundError(v.policyKey);
      return created;
    });
  }

  async updatePlacementPolicy(cmd: UpdatePlacementPolicyCommand): Promise<PlacementPolicyDetailDto> {
    const v = this.validateCommand(UpdatePlacementPolicyCommandSchema, cmd, 'updating placement policy');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'system.config', null);

    return await this.transactionPort.runInTransaction(async () => {
      const policyId = await this.systemConfigRepository.updatePlacementPolicy(
        v.policyKey,
        v.name,
        v.description ?? '',
        v.policyMode,
        v.expectedRowVersion
      );

      await this.auditPort.record(
        v.actorUserId,
        'system.update_placement_policy',
        'placement_policy',
        policyId,
        null,
        null,
        { policyKey: v.policyKey, name: v.name, policyMode: v.policyMode }
      );

      const updated = await this.systemConfigRepository.getPlacementPolicyByKey(v.policyKey);
      if (!updated) throw new PlacementPolicyNotFoundError(v.policyKey);
      return updated;
    });
  }

  async deletePlacementPolicy(cmd: DeletePlacementPolicyCommand): Promise<void> {
    const v = this.validateCommand(DeletePlacementPolicyCommandSchema, cmd, 'deleting placement policy');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'system.config', null);

    return await this.transactionPort.runInTransaction(async () => {
      const policyId = await this.systemConfigRepository.deletePlacementPolicy(
        v.policyKey,
        v.expectedRowVersion
      );

      await this.auditPort.record(
        v.actorUserId,
        'system.delete_placement_policy',
        'placement_policy',
        policyId,
        null,
        null,
        { policyKey: v.policyKey }
      );
    });
  }

  async createPlacementRule(cmd: CreatePlacementRuleCommand): Promise<void> {
    const v = this.validateCommand(CreatePlacementRuleCommandSchema, cmd, 'creating placement rule');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'system.config', null);

    return await this.transactionPort.runInTransaction(async () => {
      const policy = await this.systemConfigRepository.findPlacementPolicyByKey(v.policyKey);
      if (!policy) {
        throw new PlacementPolicyNotFoundError(v.policyKey);
      }

      const ruleId = this.idGenerator.generate();
      await this.systemConfigRepository.createPlacementRule(
        ruleId,
        policy.id,
        v.ruleType,
        v.targetNodeId ?? null,
        v.targetNodeTypeId ?? null,
        v.comparator ?? null,
        v.valueText ?? null
      );

      await this.auditPort.record(
        v.actorUserId,
        'system.create_placement_rule',
        'placement_policy',
        policy.id,
        null,
        null,
        { ruleType: v.ruleType, targetNodeId: v.targetNodeId, targetNodeTypeId: v.targetNodeTypeId }
      );
    });
  }

  async deletePlacementRule(cmd: DeletePlacementRuleCommand): Promise<void> {
    const v = this.validateCommand(DeletePlacementRuleCommandSchema, cmd, 'deleting placement rule');
    await this.accessControlPort.assertHasPermission(v.actorUserId, 'system.config', null);

    return await this.transactionPort.runInTransaction(async () => {
      await this.systemConfigRepository.deletePlacementRule(v.ruleId);
      await this.auditPort.record(
        v.actorUserId,
        'system.delete_placement_rule',
        'placement_policy',
        v.ruleId,
        null,
        null,
        null
      );
    });
  }

  private validateCommand<T>(schema: z.ZodSchema<T>, raw: unknown, actionName: string): T {
    const res = schema.safeParse(raw);
    if (!res.success) {
      const issues: Record<string, string[]> = {};
      for (const issue of res.error.issues) {
        const key = issue.path.join('.') || 'root';
        if (!issues[key]) issues[key] = [];
        issues[key].push(issue.message);
      }
      throw new SystemConfigValidationError(`Validation failed for ${actionName}.`, issues);
    }
    return res.data;
  }
}
