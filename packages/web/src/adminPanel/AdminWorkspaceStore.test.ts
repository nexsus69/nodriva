/** Verifies reload-oriented workspace restoration and user isolation transitions. */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_WORKSPACE_STATE,
  useAdminWorkspaceStore,
} from "./AdminWorkspaceStore";

describe("Admin workspace store", () => {
  beforeEach(() => {
    useAdminWorkspaceStore.setState(DEFAULT_ADMIN_WORKSPACE_STATE);
  });

  it("restores navigation, surfaces, and drafts through one state contract", () => {
    const store = useAdminWorkspaceStore.getState();
    store.setUserContext("user-1");
    store.setActiveModule("model.types");
    store.toggleModule("model");
    store.selectResource({
      moduleKey: "model.types",
      resourceId: "entity_type",
    });
    store.openSurface({
      kind: "drawer",
      key: "type-detail",
      moduleKey: "model.types",
      mode: "edit",
      resourceId: "entity_type",
    });
    store.saveDraft({
      key: "model.types:entity_type",
      values: { label: "Draft" },
      formVersion: "1",
      updatedAt: 10,
      rowVersion: 2,
    });

    const restored = useAdminWorkspaceStore.getState();
    expect(restored.activeModuleKey).toBe("model.types");
    expect(restored.expandedModuleKeys).toEqual(["model"]);
    expect(restored.surface?.key).toBe("type-detail");
    expect(restored.surface).toMatchObject({
      mode: "edit",
      resourceId: "entity_type",
    });
    expect(restored.drafts["model.types:entity_type"]?.values.label).toBe(
      "Draft",
    );
  });

  it("clears another user context instead of leaking navigation or drafts", () => {
    const store = useAdminWorkspaceStore.getState();
    store.setUserContext("user-1");
    store.setActiveModule("access.users");
    store.saveDraft({
      key: "user:create",
      values: { email: "private@example.com" },
      formVersion: "1",
      updatedAt: 10,
    });

    store.setUserContext("user-2");
    const isolated = useAdminWorkspaceStore.getState();
    expect(isolated.userId).toBe("user-2");
    expect(isolated.activeModuleKey).toBe("overview");
    expect(isolated.drafts).toEqual({});
  });

  it("removes individual drafts and preserves the rest of the workspace", () => {
    const store = useAdminWorkspaceStore.getState();
    store.setUserContext("user-1");
    store.saveDraft({ key: "a", values: {}, formVersion: "1", updatedAt: 1 });
    store.saveDraft({ key: "b", values: {}, formVersion: "1", updatedAt: 1 });

    store.removeDraft("a");
    expect(useAdminWorkspaceStore.getState().drafts).toEqual({
      b: { key: "b", values: {}, formVersion: "1", updatedAt: 1 },
    });
  });

  it("persists module-local navigation state through the shared contract", () => {
    const store = useAdminWorkspaceStore.getState();
    store.setModuleState("model.types", { kind: "entity" });
    store.setModuleState("model.types", { filter: "project" });

    expect(
      useAdminWorkspaceStore.getState().moduleState["model.types"],
    ).toEqual({ kind: "entity", filter: "project" });
    store.clearModuleState("model.types");
    expect(
      useAdminWorkspaceStore.getState().moduleState["model.types"],
    ).toBeUndefined();
  });
});
