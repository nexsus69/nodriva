import { Role } from '../../domain/models/Role.js';
import {
  RoleListItemDto,
  RoleDetailDto,
  PermissionDto,
  ScopeAssignmentDto,
  RealtimeScopeAssignmentDto,
} from '../dto/SecurityAdminDtos.js';

export interface SecurityRepository {
  listRoles(): Promise<RoleListItemDto[]>;
  getRoleByKey(roleKey: string): Promise<RoleDetailDto | null>;
  findRoleById(id: string): Promise<Role | null>;
  findRoleByKey(roleKey: string): Promise<Role | null>;
  createRole(role: Role, permissionIds?: string[]): Promise<void>;
  updateRole(role: Role): Promise<void>;
  updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;
  listAllPermissions(): Promise<PermissionDto[]>;
  listScopeAssignments(): Promise<ScopeAssignmentDto[]>;
  getScopeAssignmentById(id: string): Promise<ScopeAssignmentDto | null>;
  listRealtimeScopeAssignments(userId: string): Promise<RealtimeScopeAssignmentDto[]>;
  createScopeAssignment(
    id: string,
    userId: string,
    nodeId: string,
    roleId: string,
    assignmentEffect: 'allow' | 'deny',
    propagation: 'self' | 'subtree',
    assignedBy: string
  ): Promise<void>;
  updateScopeAssignment(
    id: string,
    roleId: string,
    assignmentEffect: 'allow' | 'deny',
    propagation: 'self' | 'subtree'
  ): Promise<void>;
  deleteScopeAssignment(id: string): Promise<void>;
}
