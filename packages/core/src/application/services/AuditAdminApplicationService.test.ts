import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditAdminApplicationService } from './AuditAdminApplicationService.js';
import { AuditQueryPort } from '../ports/AuditQueryPort.js';
import { AccessControlPort } from '../ports/AccessControlPort.js';
import { AuditLogDetailDto, AuditLogListItemDto, PaginatedResultDto } from '../dto/AuditQueryDtos.js';

describe('AuditAdminApplicationService', () => {
  let mockAuditQueryPort: AuditQueryPort;
  let mockAccessControlPort: AccessControlPort;
  let service: AuditAdminApplicationService;

  beforeEach(() => {
    mockAuditQueryPort = {
      listAuditLogs: vi.fn(),
      getAuditLogById: vi.fn(),
    };

    mockAccessControlPort = {
      assertCanReadNode: vi.fn(),
      assertCanCreateEntity: vi.fn(),
      assertCanEditEntity: vi.fn(),
      assertCanDeleteEntity: vi.fn(),
      assertCanCreateNode: vi.fn(),
      assertCanMoveNode: vi.fn(),
      assertCanMoveEntity: vi.fn(),
      assertHasPermission: vi.fn().mockResolvedValue(undefined),
      assertHasPermissionCoverage: vi.fn().mockResolvedValue(undefined),
      assertHasPermissionCoverageBatch: vi.fn().mockResolvedValue(undefined),
      assertIsSuperAdmin: vi.fn().mockResolvedValue(undefined),
    };

    service = new AuditAdminApplicationService(mockAuditQueryPort, mockAccessControlPort);
  });

  it('should list audit logs with pagination and filters', async () => {
    const mockResult: PaginatedResultDto<AuditLogListItemDto> = {
      items: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          actorUserId: '00000000-0000-0000-0000-000000000002',
          actorEmail: 'admin@mate.com',
          actionKey: 'user.create',
          resourceKind: 'user',
          resourceId: '00000000-0000-0000-0000-000000000003',
          nodeId: null,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    };

    vi.mocked(mockAuditQueryPort.listAuditLogs).mockResolvedValue(mockResult);

    const res = await service.getAuditLogs('user1', { actionKey: 'user.create' });

    expect(res).toEqual(mockResult);
    expect(mockAuditQueryPort.listAuditLogs).toHaveBeenCalledWith({ actionKey: 'user.create' });
  });

  it('should return audit log detail by id', async () => {
    const mockDetail: AuditLogDetailDto = {
      id: '00000000-0000-0000-0000-000000000001',
      actorUserId: '00000000-0000-0000-0000-000000000002',
      actorEmail: 'admin@mate.com',
      actionKey: 'user.create',
      resourceKind: 'user',
      resourceId: '00000000-0000-0000-0000-000000000003',
      nodeId: null,
      beforePayload: null,
      afterPayload: { email: 'test@mate.com' },
      createdAt: new Date().toISOString(),
    };

    vi.mocked(mockAuditQueryPort.getAuditLogById).mockResolvedValue(mockDetail);

    const res = await service.getAuditLogById('user1', '00000000-0000-0000-0000-000000000001');

    expect(res).toEqual(mockDetail);
    expect(mockAuditQueryPort.getAuditLogById).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001');
  });

  it('should return null if audit log is not found', async () => {
    vi.mocked(mockAuditQueryPort.getAuditLogById).mockResolvedValue(null);

    const res = await service.getAuditLogById('user1', 'non-existent-id');

    expect(res).toBeNull();
  });
});
