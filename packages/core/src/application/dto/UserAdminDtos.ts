export interface UserRoleDto {
  id: string;
  roleKey: string;
  name: string;
}

export interface UserListItemDto {
  id: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  roles: UserRoleDto[];
  createdAt: string;
  updatedAt: string;
}

export interface UserDetailDto {
  id: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  rowVersion: number;
  roles: UserRoleDto[];
  allAvailableRoles: UserRoleDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserUiCommand {
  email: string;
  password: string;
  isSuperAdmin?: boolean;
  roleIds?: string[];
}

export interface UpdateUserStatusUiCommand {
  userId: string;
  isActive: boolean;
  expectedRowVersion: number;
}

export interface AssignUserRolesUiCommand {
  userId: string;
  roleIds: string[];
  expectedRowVersion: number;
}

export interface UpdateUserUiCommand {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  expectedRowVersion: number;
}

export interface ResetUserPasswordUiCommand {
  userId: string;
  newPassword: string;
  expectedRowVersion: number;
}
