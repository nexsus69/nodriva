export interface PermissionDto {
  id: string;
  permissionKey: string;
  name: string;
  description: string;
  resourceKind: string;
}

export interface RoleListItemDto {
  id: string;
  roleKey: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionCount: number;
  updatedAt: string;
}

export interface RoleDetailDto {
  id: string;
  roleKey: string;
  name: string;
  description: string;
  isSystem: boolean;
  rowVersion: number;
  permissions: PermissionDto[];
  allAvailablePermissions: PermissionDto[];
  updatedAt: string;
}

export interface ScopeAssignmentDto {
  id: string;
  userId: string;
  userEmail: string;
  nodeId: string;
  nodeName: string;
  roleId: string;
  roleName: string;
  assignmentEffect: 'allow' | 'deny';
  propagation: 'self' | 'subtree';
  assignedAt: string;
}

export interface RealtimeScopeAssignmentDto {
  nodeId: string;
  propagation: 'self' | 'subtree';
}

export interface CreateRoleUiCommand {
  roleKey: string;
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRolePermissionsUiCommand {
  roleKey: string;
  permissionIds: string[];
  expectedRowVersion: number;
}

export interface CreateScopeAssignmentUiCommand {
  userId: string;
  nodeId: string;
  roleId: string;
  assignmentEffect: 'allow' | 'deny';
  propagation: 'self' | 'subtree';
}

export interface DeleteScopeAssignmentUiCommand {
  assignmentId: string;
}

export interface UpdateScopeAssignmentUiCommand {
  assignmentId: string;
  roleId: string;
  assignmentEffect: 'allow' | 'deny';
  propagation: 'self' | 'subtree';
}
