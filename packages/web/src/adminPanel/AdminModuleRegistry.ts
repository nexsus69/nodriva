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
        icon: "schema",
        order: 10,
        route: "/admin/model/types",
        requiredPermissions: ["node_type.read", "entity_type.read"],
        permissionMode: "any",
      },
      {
        key: "model.placement-policies", label: "Placement policies", labelKey: "admin.placementPolicies", description: "Control where operational data can be placed.", descriptionKey: "admin.placementPoliciesDescription", icon: "scope", order: 20, route: "/admin/model/placement-policies", requiredPermissions: ["system.config.read"],
      },
      {
        key: "model.field-protection", label: "Field protection", labelKey: "admin.fieldProtection", description: "Configure field encryption.", descriptionKey: "admin.fieldProtectionDescription", icon: "shield", order: 30, route: "/admin/model/field-protection", requiredPermissions: ["system.config.read"],
      },
    ],
  },
  {
    key: "content",
    label: "Content",
    labelKey: "admin.content",
    description: "Browse the operational records visible in your scopes.",
    descriptionKey: "admin.contentDescription",
    icon: "database",
    order: 20,
    children: [
      {
        key: "content.nodes",
        label: "Nodes",
        labelKey: "admin.nodes",
        description: "Browse and manage the visible node hierarchy.",
        descriptionKey: "admin.nodesDescription",
        icon: "nodes",
        order: 10,
        route: "/admin/content/nodes",
        requiredPermissions: ["node.read"],
      },
      {
        key: "content.attachment-protection", label: "Attachment protection", labelKey: "admin.attachmentProtection", description: "Configure attachment security.", descriptionKey: "admin.attachmentProtectionDescription", icon: "shield", order: 30, route: "/admin/content/attachment-protection", requiredPermissions: ["system.config.read"],
      },
      {
        key: "content.entities",
        label: "Entities",
        labelKey: "admin.entities",
        description: "Browse and manage entities in visible scopes.",
        descriptionKey: "admin.entitiesDescription",
        icon: "entities",
        order: 20,
        route: "/admin/content/entities",
        requiredPermissions: ["node.read", "entity.read"],
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
    order: 30,
    children: [
      {
        key: "access.users",
        label: "Users",
        labelKey: "admin.users",
        description: "Manage administrative identities and their access.",
        descriptionKey: "admin.usersDescription",
        icon: "users",
        order: 10,
        route: "/admin/access/users",
        requiredPermissions: ["user.read"],
      },
      {
        key: "access.roles",
        label: "Roles",
        labelKey: "admin.roles",
        description: "Manage reusable permission roles.",
        descriptionKey: "admin.rolesDescription",
        icon: "roles",
        order: 20,
        route: "/admin/access/roles",
        requiredPermissions: ["role.read"],
      },
      {
        key: "access.scopes",
        label: "Scopes",
        labelKey: "admin.scopes",
        description: "Manage user access assignments and propagation.",
        descriptionKey: "admin.scopesDescription",
        icon: "scope",
        order: 30,
        route: "/admin/access/scopes",
        requiredPermissions: ["scope.read"],
      },
    ],
  },
  {
    key: "automation",
    label: "Automation",
    labelKey: "admin.automation",
    description: "Configure durable event-driven automations.",
    descriptionKey: "admin.automationDescription",
    icon: "activity",
    order: 40,
    children: [
      {
        key: "automation.workflows",
        label: "Workflows",
        labelKey: "admin.workflows",
        description: "Configure durable event-driven automations.",
        descriptionKey: "admin.workflowsDescription",
        icon: "activity",
        order: 10,
        route: "/admin/automation/workflows",
        requiredPermissions: ["system.config.read"],
      },
    ],
  },
  {
    key: "governance", label: "Governance", labelKey: "admin.governance", description: "Review evidence and lifecycle controls.", descriptionKey: "admin.governanceDescription", icon: "activity",
    order: 50,
    children: [
      {
        key: "governance.audit", label: "Audit log", labelKey: "admin.auditLog", description: "Filter administrative events and inspect immutable changes.", descriptionKey: "admin.auditDescription", icon: "activity",
        order: 10,
        route: "/admin/governance/audit", requiredPermissions: ["audit.access"],
      },
      {
        key: "governance.audit-recording", label: "Audit recording", labelKey: "admin.auditRecording", description: "Configure audit evidence.", descriptionKey: "admin.auditRecordingDescription", order: 20, route: "/admin/governance/audit-recording",
        requiredPermissions: ["system.config.read"], icon: "settings",
      },
      { key: "governance.recycle-bin", label: "Recycle bin", labelKey: "admin.recycleBin", description: "Restore or permanently remove deleted resources.", descriptionKey: "admin.recycleBinDescription", icon: "recycle", order: 30, route: "/admin/governance/recycle-bin", requiredPermissions: ["node.restore", "entity.restore"], permissionMode: "any" },
    ],
  },
  {
    key: "platform", label: "Platform", labelKey: "admin.platform", description: "Configure runtime and global security.", descriptionKey: "admin.platformDescription", icon: "settings", order: 60, children: [
      {
        key: "platform.runtime", label: "Runtime", labelKey: "admin.runtime", description: "Manage runtime capability status.", descriptionKey: "admin.runtimeDescription", icon: "settings", order: 10, route: "/admin/platform/runtime", requiredPermissions: ["system.config.read"],
      },
      { key: "platform.session-security", label: "Session security", labelKey: "admin.sessionSecurity", description: "Configure session inactivity.", descriptionKey: "admin.sessionSecurityDescription", icon: "shield", order: 20, route: "/admin/platform/session-security", requiredPermissions: ["system.config.read"] },
      { key: "platform.other-settings", label: "Other settings", labelKey: "admin.otherSettings", description: "Access settings that are not yet assigned to an administrative module.", descriptionKey: "admin.otherSettingsDescription", icon: "settings", order: 30, route: "/admin/platform/other-settings", requiredPermissions: ["system.config.read"] },
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
