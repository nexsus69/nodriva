import type { User } from '../../domain/models/User.js';
import type { UserListItemDto, UserDetailDto, UserRoleDto } from '../dto/UserAdminDtos.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listUsers(): Promise<UserListItemDto[]>;
  listUsersManageableBy(actorUserId: string): Promise<UserListItemDto[]>;
  getUserDetailManageableBy(actorUserId: string, userId: string): Promise<UserDetailDto | null>;
  isUserManageableBy(actorUserId: string, userId: string): Promise<boolean>;
  getUserDetail(id: string): Promise<UserDetailDto | null>;
  listAllRoles(): Promise<UserRoleDto[]>;
  createUser(user: User, roleIds?: string[]): Promise<void>;
  updateUser(user: User): Promise<void>;
  assignUserRoles(userId: string, roleIds: string[]): Promise<void>;
}
