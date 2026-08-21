/** Registers the canonical recursive module tree used by the Admin Panel. */
import {
  filterAdminModules,
  findAdminModule,
  sortAdminModules,
  type AdminModule,
  type AdminModuleContext,
} from './AdminModule';

/** Canonical module tree for the current Admin Panel information architecture. */
export const ADMIN_MODULES: readonly AdminModule[] = [
  {
    key: 'overview',
    label: 'Overview',
    description: 'Administrative status and entry points.',
    icon: 'dashboard',
    order: 0,
    route: '/admin',
  },
  {
    key: 'model',
    label: 'Model',
    description: 'Define the types and relationships used by the application.',
    icon: 'schema',
    order: 10,
    children: [
      {
        key: 'model.types',
        label: 'Types',
        description: 'Manage node and entity type definitions.',
        order: 10,
        route: '/admin/types',
        requiredPermissions: ['node_type.read', 'entity_type.read'],
        permissionMode: 'any',
      },
    ],
  },
  {
    key: 'access',
    label: 'Access',
    description: 'Manage identities, roles, and scope assignments.',
    icon: 'shield',
    order: 20,
    children: [
      { key: 'access.users', label: 'Users', order: 10, route: '/admin/users', requiredPermissions: ['user.read'] },
      { key: 'access.roles', label: 'Roles', order: 20, route: '/admin/security/roles', requiredPermissions: ['role.read'] },
      { key: 'access.scopes', label: 'Scopes', order: 30, route: '/admin/security/scopes', requiredPermissions: ['scope.read'] },
    ],
  },
  {
    key: 'activity',
    label: 'Activity',
    description: 'Review audit history and recover deleted resources.',
    icon: 'activity',
    order: 30,
    children: [
      { key: 'activity.audit', label: 'Audit log', order: 10, route: '/admin/audit', requiredPermissions: ['audit.read'] },
      { key: 'activity.recycle-bin', label: 'Recycle bin', order: 20, route: '/admin/recycle-bin', requiredPermissions: ['recycle.read'] },
    ],
  },
  {
    key: 'system',
    label: 'System',
    description: 'Configure runtime capabilities and placement policies.',
    icon: 'settings',
    order: 40,
    children: [
      { key: 'system.capabilities', label: 'Capabilities', order: 10, route: '/admin/system/config', requiredPermissions: ['system.config.read'] },
      { key: 'system.placement-policies', label: 'Placement policies', order: 20, route: '/admin/system/placement-policies', requiredPermissions: ['system.config.read'] },
    ],
  },
];

/** Provides immutable access to the canonical module tree and its projections. */
export class AdminModuleRegistry {
  private readonly modules: readonly AdminModule[];

  /** Creates a registry from a module tree, normalizing order once. */
  public constructor(modules: readonly AdminModule[] = ADMIN_MODULES) {
    this.modules = sortAdminModules(modules);
  }

  /** Returns the complete module tree for navigation and introspection. */
  public all(): readonly AdminModule[] {
    return this.modules;
  }

  /** Returns only modules visible to the supplied authorization context. */
  public visible(context: AdminModuleContext): AdminModule[] {
    return filterAdminModules(this.modules, context);
  }

  /** Resolves a module key regardless of its nesting depth. */
  public find(key: string): AdminModule | null {
    return findAdminModule(this.modules, key);
  }
}

/** Shared registry instance used by Admin Panel composition code. */
export const adminModuleRegistry = new AdminModuleRegistry();
