import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemAdminApplicationService } from './SystemAdminApplicationService.js';
import { SystemConfigRepository } from '../ports/SystemConfigRepository.js';
import { AuditPort } from '../ports/AuditPort.js';
import { TransactionPort } from '../ports/TransactionPort.js';
import { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import { AccessControlPort } from '../ports/AccessControlPort.js';
import { PlacementPolicyKeyAlreadyExistsError } from '../../domain/errors/SystemAdminErrors.js';

const ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const POLICY_ID = '00000000-0000-0000-0000-000000000040';

describe('SystemAdminApplicationService', () => {
  let mockRepository: SystemConfigRepository;
  let mockAuditPort: AuditPort;
  let mockTransactionPort: TransactionPort;
  let mockIdGenerator: IdGeneratorPort;
  let mockAccessControlPort: AccessControlPort;
  let service: SystemAdminApplicationService;

  beforeEach(() => {
    mockRepository = {
      listCapabilities: vi.fn().mockResolvedValue([]),
      updateCapabilityStatus: vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000099'),
      listSettings: vi.fn().mockResolvedValue([]),
      updateSetting: vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000098'),
      listPlacementPolicies: vi.fn().mockResolvedValue([]),
      getPlacementPolicyByKey: vi.fn().mockResolvedValue(null),
      findPlacementPolicyByKey: vi.fn().mockResolvedValue(null),
      createPlacementPolicy: vi.fn().mockResolvedValue(undefined),
      updatePlacementPolicy: vi.fn().mockResolvedValue(POLICY_ID),
      deletePlacementPolicy: vi.fn().mockResolvedValue(POLICY_ID),
      createPlacementRule: vi.fn().mockResolvedValue(undefined),
      deletePlacementRule: vi.fn().mockResolvedValue(undefined),
    };

    mockAuditPort = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    mockTransactionPort = {
      runInTransaction: vi.fn().mockImplementation(async (work) => await work()),
    };

    mockIdGenerator = {
      generate: vi.fn().mockReturnValue(POLICY_ID),
    };

    mockAccessControlPort = {
      assertCanReadNode: vi.fn(),
      assertCanCreateEntity: vi.fn(),
      assertCanEditEntity: vi.fn(),
      assertCanCreateNode: vi.fn(),
      assertCanMoveNode: vi.fn(),
      assertCanMoveEntity: vi.fn(),
      assertHasPermission: vi.fn().mockResolvedValue(undefined),
    };

    service = new SystemAdminApplicationService(
      mockRepository,
      mockAuditPort,
      mockTransactionPort,
      mockIdGenerator,
      mockAccessControlPort
    );
  });

  it('should update capability status successfully', async () => {
    await service.updateCapabilityStatus({
      capabilityKey: 'locking',
      status: 'enabled',
      actorUserId: ACTOR_ID,
    });

    expect(mockRepository.updateCapabilityStatus).toHaveBeenCalledWith('locking', 'enabled', ACTOR_ID);
    expect(mockAuditPort.record).toHaveBeenCalledWith(
      ACTOR_ID,
      'system.update_capability',
      'runtime_capability',
      '00000000-0000-0000-0000-000000000099',
      null,
      null,
      expect.any(Object)
    );
  });

  it('should update system setting successfully', async () => {
    await service.updateSetting({
      settingKey: 'active_profile',
      settingValueText: 'multi-tenant',
      expectedRowVersion: 1,
      actorUserId: ACTOR_ID,
    });

    expect(mockRepository.updateSetting).toHaveBeenCalledWith('active_profile', 'multi-tenant', 1, ACTOR_ID);
    expect(mockAuditPort.record).toHaveBeenCalledWith(
      ACTOR_ID,
      'system.update_setting',
      'system_setting',
      '00000000-0000-0000-0000-000000000098',
      null,
      null,
      expect.any(Object)
    );
  });

  it('should create placement policy successfully', async () => {
    vi.mocked(mockRepository.findPlacementPolicyByKey).mockResolvedValue(null);
    vi.mocked(mockRepository.getPlacementPolicyByKey).mockResolvedValue({
      id: POLICY_ID,
      policyKey: 'custom_policy',
      name: 'Custom Policy',
      description: 'Test policy',
      policyMode: 'node_type_whitelist',
      rowVersion: 1,
      rules: [],
      updatedAt: new Date().toISOString(),
    });

    const res = await service.createPlacementPolicy({
      policyKey: 'custom_policy',
      name: 'Custom Policy',
      description: 'Test policy',
      policyMode: 'node_type_whitelist',
      actorUserId: ACTOR_ID,
    });

    expect(res.policyKey).toBe('custom_policy');
    expect(mockRepository.createPlacementPolicy).toHaveBeenCalledWith(
      POLICY_ID,
      'custom_policy',
      'Custom Policy',
      'Test policy',
      'node_type_whitelist'
    );
  });

  it('should throw PlacementPolicyKeyAlreadyExistsError if policyKey is taken', async () => {
    vi.mocked(mockRepository.findPlacementPolicyByKey).mockResolvedValue({
      id: POLICY_ID,
      policyKey: 'custom_policy',
      name: 'Existing',
      description: '',
      policyMode: 'allow_all',
      rowVersion: 1,
    });

    await expect(
      service.createPlacementPolicy({
        policyKey: 'custom_policy',
        name: 'Custom Policy',
        policyMode: 'allow_all',
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow(PlacementPolicyKeyAlreadyExistsError);
  });

  it('should update placement policy successfully', async () => {
    vi.mocked(mockRepository.getPlacementPolicyByKey).mockResolvedValue({
      id: POLICY_ID,
      policyKey: 'custom_policy',
      name: 'Updated Name',
      description: 'Updated Description',
      policyMode: 'allow_all',
      rowVersion: 2,
      rules: [],
      updatedAt: new Date().toISOString(),
    });

    const res = await service.updatePlacementPolicy({
      policyKey: 'custom_policy',
      name: 'Updated Name',
      description: 'Updated Description',
      policyMode: 'allow_all',
      expectedRowVersion: 1,
      actorUserId: ACTOR_ID,
    });

    expect(res.name).toBe('Updated Name');
    expect(mockRepository.updatePlacementPolicy).toHaveBeenCalledWith(
      'custom_policy',
      'Updated Name',
      'Updated Description',
      'allow_all',
      1
    );
  });

  it('should delete placement policy successfully', async () => {
    await service.deletePlacementPolicy({
      policyKey: 'custom_policy',
      expectedRowVersion: 1,
      actorUserId: ACTOR_ID,
    });

    expect(mockRepository.deletePlacementPolicy).toHaveBeenCalledWith('custom_policy', 1);
  });
});
