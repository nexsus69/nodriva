/** Defines transport-safe projections returned by the security administration use cases. */
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

/** A grant removed because its recorded delegator no longer covers it. */
export interface RevokedDelegatedScopeAssignmentDto {
  id: string;
  userId: string;
  nodeId: string;
  roleId: string;
  assignedBy: string;
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

export interface UpdateRoleMetadataUiCommand {
  roleKey: string;
  name: string;
  description?: string;
  expectedRowVersion: number;
}

/** Updates all editable role state through one atomic application command. */
export interface UpdateRoleUiCommand {
  roleKey: string;
  name: string;
  description?: string;
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
