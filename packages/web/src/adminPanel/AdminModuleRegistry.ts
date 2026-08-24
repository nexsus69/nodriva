/** Registers the canonical recursive module tree used by the Admin Panel. */
import {
  filterAdminModules,
  findAdminModule,
  sortAdminModules,
  type AdminModule,
  type AdminModuleContext,
} from "./AdminModule";

/** Canonical module tree for the current Admin Panel information architecture. */
export const ADMIN_MODULES: readonly AdminModule[] = [
  {
    key: "overview",
    label: "Overview",
    labelKey: "admin.overview",
    description: "Administrative status and entry points.",
    icon: "dashboard",
    order: 0,
    route: "/admin",
  },
  {
    key: "model",
    label: "Model",
    labelKey: "admin.model",
    description: "Define the types and relationships used by the application.",
    descriptionKey: "admin.modelDescription",
    icon: "schema",
    order: 10,
    children: [
      {
        key: "model.types",
        label: "Types",
        labelKey: "admin.types",
        description: "Manage node and entity type definitions.",
        descriptionKey: "admin.typesDescription",
        order: 10,
        route: "/admin/types",
        requiredPermissions: ["node_type.read", "entity_type.read"],
        permissionMode: "any",
      },
    ],
  },
  {
    key: "access",
    label: "Access",
    labelKey: "admin.access",
    description: "Manage identities, roles, and scope assignments.",
    descriptionKey: "admin.accessDescription",
    icon: "shield",
    order: 20,
    children: [
      {
        key: "access.users",
        label: "Users",
        labelKey: "admin.users",
        description: "Manage administrative identities and their access.",
        descriptionKey: "admin.usersDescription",
        order: 10,
        route: "/admin/users",
        requiredPermissions: ["user.read"],
      },
      {
        key: "access.roles",
        label: "Roles",
        labelKey: "admin.roles",
        description: "Manage reusable permission roles.",
        descriptionKey: "admin.rolesDescription",
        order: 20,
        route: "/admin/security/roles",
        requiredPermissions: ["role.read"],
      },
      {
        key: "access.scopes",
        label: "Scopes",
        labelKey: "admin.scopes",
        description: "Manage user access assignments and propagation.",
        descriptionKey: "admin.scopesDescription",
        order: 30,
        route: "/admin/security/scopes",
        requiredPermissions: ["scope.read"],
      },
    ],
  },
  {
    key: "activity",
    label: "Activity",
    labelKey: "admin.activity",
    description: "Review audit history and recover deleted resources.",
    descriptionKey: "admin.activityDescription",
    icon: "activity",
    order: 30,
    children: [
      {
        key: "activity.audit",
        label: "Audit log",
        labelKey: "admin.auditLog",
        description: "Filter administrative events and inspect immutable changes.",
        descriptionKey: "admin.auditDescription",
        order: 10,
        route: "/admin/audit",
        requiredPermissions: ["audit.access"],
      },
      {
        key: "activity.recycle-bin",
        label: "Recycle bin",
        labelKey: "admin.recycleBin",
        description: "Restore or permanently remove deleted resources.",
        descriptionKey: "admin.recycleBinDescription",
        order: 20,
        route: "/admin/recycle-bin",
        requiredPermissions: ["node.restore", "entity.restore"],
        permissionMode: "any",
      },
    ],
  },
  {
    key: "system",
    label: "System",
    labelKey: "admin.system",
    description: "Configure runtime capabilities and placement policies.",
    descriptionKey: "admin.systemDescription",
    icon: "settings",
    order: 40,
    children: [
      {
        key: "system.capabilities",
        label: "Capabilities",
        labelKey: "admin.capabilities",
        description: "Manage runtime capability status.",
        descriptionKey: "admin.capabilitiesDescription",
        order: 10,
        route: "/admin/system/config",
        requiredPermissions: ["system.config.read"],
      },
      {
        key: "system.settings",
        label: "System settings",
        labelKey: "admin.systemSettings",
        description: "Manage runtime configuration values.",
        descriptionKey: "admin.systemSettingsDescription",
        order: 15,
        route: "/admin/system/settings",
        requiredPermissions: ["system.config.read"],
      },
      {
        key: "system.placement-policies",
        label: "Placement policies",
        labelKey: "admin.placementPolicies",
        description: "Control where operational data can be placed.",
        descriptionKey: "admin.placementPoliciesDescription",
        order: 20,
        route: "/admin/system/placement-policies",
        requiredPermissions: ["system.config.read"],
      },
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
