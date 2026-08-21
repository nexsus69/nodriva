/** Defines the recursive contract shared by every Admin Panel navigation node. */
export interface AdminModule {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  order: number;
  route?: string;
  requiredPermissions?: readonly string[];
  permissionMode?: 'all' | 'any';
  featureFlag?: string;
  children?: readonly AdminModule[];
  actions?: readonly AdminModuleAction[];
}

/** Describes an action that can be exposed by any module level. */
export interface AdminModuleAction {
  key: string;
  label: string;
  requiredPermissions?: readonly string[];
}

/** Supplies the authorization and feature state used to build visible modules. */
export interface AdminModuleContext {
  permissions: ReadonlySet<string>;
  featureFlags?: ReadonlySet<string>;
}

/** Returns whether a module is allowed in the current administrative context. */
export function isAdminModuleVisible(module: AdminModule, context: AdminModuleContext): boolean {
  const requiredPermissions = module.requiredPermissions ?? [];
  const permissionsAllowed = module.permissionMode === 'any'
    ? requiredPermissions.length === 0 || requiredPermissions.some((permission) => context.permissions.has(permission))
    : requiredPermissions.every((permission) => context.permissions.has(permission));
  const featureAllowed = !module.featureFlag || context.featureFlags?.has(module.featureFlag) === true;
  return permissionsAllowed && featureAllowed;
}

/** Sorts a module tree without mutating the registry definitions. */
export function sortAdminModules(modules: readonly AdminModule[]): AdminModule[] {
  return [...modules]
    .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
    .map((node) => ({
      ...node,
      children: node.children ? sortAdminModules(node.children) : undefined,
    }));
}

/** Filters a module tree while retaining authorized parents of visible children. */
export function filterAdminModules(modules: readonly AdminModule[], context: AdminModuleContext): AdminModule[] {
  return sortAdminModules(modules).flatMap((node) => {
    const children = node.children ? filterAdminModules(node.children, context) : [];
    if (!isAdminModuleVisible(node, context)) return [];
    if (!node.route && children.length === 0) return [];
    return [{ ...node, children }];
  });
}

/** Finds a module by key at any depth in a recursive module tree. */
export function findAdminModule(modules: readonly AdminModule[], key: string): AdminModule | null {
  for (const node of modules) {
    if (node.key === key) return node;
    const nested = node.children ? findAdminModule(node.children, key) : null;
    if (nested) return nested;
  }
  return null;
}
