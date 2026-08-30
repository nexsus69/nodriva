/** Verifies recursive module contracts, ordering, lookup, and authorization projections. */
import { describe, expect, it } from "vitest";
import { findAdminModuleByRoute, isAdminModuleRouteMatch } from "./AdminModule";
import { ADMIN_MODULES, AdminModuleRegistry } from "./AdminModuleRegistry";

describe("AdminModuleRegistry", () => {
  it("keeps every level on the same recursive module contract", () => {
    const registry = new AdminModuleRegistry();

    expect(registry.find("model")?.children?.[0]?.key).toBe("model.types");
    expect(registry.find("model.types")?.route).toBe("/admin/model/types");
  });

  it("does not retain routes replaced by the controlled information-architecture break", () => {
    const modules = new AdminModuleRegistry().all();

    for (const route of [
      "/admin/types",
      "/admin/users",
      "/admin/security/roles",
      "/admin/security/scopes",
      "/admin/system/config",
      "/admin/system/settings",
      "/admin/system/placement-policies",
      "/admin/audit",
      "/admin/recycle-bin",
    ]) {
      expect(findAdminModuleByRoute(modules, route)).toBeNull();
    }
  });

  it("assigns a semantic icon to every navigable module", () => {
    const allowedIcons = new Set([
      "activity", "dashboard", "database", "entities", "external", "nodes",
      "recycle", "roles", "schema", "settings", "shield", "scope", "users",
    ]);
    const visit = (modules: readonly typeof ADMIN_MODULES[number][]): void => {
      for (const entry of modules) {
        if (entry.route) {
          expect(entry.icon, entry.key).toBeTruthy();
          expect(allowedIcons.has(entry.icon!), entry.key).toBe(true);
        }
        if (entry.children) visit(entry.children);
      }
    };
    visit(ADMIN_MODULES);
  });

  it("keeps the primary automation, governance, and settings icons distinct", () => {
    const registry = new AdminModuleRegistry();
    expect(registry.find("automation")?.icon).toBe("activity");
    expect(registry.find("governance")?.icon).toBe("shield");
    expect(registry.find("platform")?.labelKey).toBe("admin.settings");
    expect(registry.find("platform")?.icon).toBe("settings");
  });

  it("matches route segments instead of shorter sibling prefixes", () => {
    expect(isAdminModuleRouteMatch("/admin/governance/audit", "/admin/governance/audit-recording")).toBe(false);
    expect(isAdminModuleRouteMatch("/admin/governance/audit", "/admin/governance/audit/detail")).toBe(true);
    expect(findAdminModuleByRoute(ADMIN_MODULES, "/admin/governance/audit-recording")?.key).toBe("governance.audit-recording");
  });

  it("sorts modules and children by order", () => {
    const registry = new AdminModuleRegistry([
      { key: "z", label: "Z", order: 20, route: "/z" },
      {
        key: "a",
        label: "A",
        order: 10,
        route: "/a",
        children: [
          { key: "a.z", label: "Z", order: 20, route: "/a/z" },
          { key: "a.a", label: "A", order: 10, route: "/a/a" },
        ],
      },
    ]);

    expect(registry.all().map((module) => module.key)).toEqual(["a", "z"]);
    expect(registry.find("a")?.children?.map((module) => module.key)).toEqual([
      "a.a",
      "a.z",
    ]);
  });

  it("filters unauthorized leaves while retaining visible parents", () => {
    const registry = new AdminModuleRegistry(ADMIN_MODULES);
    const visible = registry.visible({ permissions: new Set(["user.read"]) });

    expect(visible.map((module) => module.key)).toEqual(["overview", "access"]);
    expect(
      visible
        .find((module) => module.key === "access")
        ?.children?.map((module) => module.key),
    ).toEqual(["access.users"]);
  });

  it("supports any-permission modules for shared administration surfaces", () => {
    const registry = new AdminModuleRegistry([
      {
        key: "model",
        label: "Model",
        order: 1,
        children: [
          {
            key: "types",
            label: "Types",
            order: 1,
            route: "/types",
            requiredPermissions: ["node_type.read", "entity_type.read"],
            permissionMode: "any",
          },
        ],
      },
    ]);

    expect(
      registry.visible({ permissions: new Set(["entity_type.read"]) }),
    ).toHaveLength(1);
  });

  it("uses unique routes and permission keys from the bootstrap catalogue", () => {
    const permissionKeys = new Set([
      "audit.access",
      "node.restore",
      "entity.restore",
      "node_type.read",
      "entity_type.read",
      "node.read",
      "entity.read",
      "user.read",
      "role.read",
      "scope.read",
      "system.config.read",
    ]);
    const visit = (modules: typeof ADMIN_MODULES): string[] =>
      modules.flatMap((module) => [
        ...(module.route ? [module.route] : []),
        ...(module.requiredPermissions ?? []).map((permission) => {
          expect(permissionKeys.has(permission), permission).toBe(true);
          return "";
        }),
        ...(module.children ? visit(module.children as typeof ADMIN_MODULES) : []),
      ]).filter(Boolean);
    const routes = visit(ADMIN_MODULES);

    expect(new Set(routes).size).toBe(routes.length);
  });
});
