import { describe, expect, it, vi } from "vitest";
import { AdminResourceController } from "./AdminResourceController";
import { defineAdminResource } from "./AdminResourceDefinition";

type Row = { id: string; name: string };

describe("AdminResourceController", () => {
  it("coordinates list, detail, create, update, and actions", async () => {
    const rows: Row[] = [{ id: "1", name: "Initial" }];
    const load = vi.fn(async () => rows);
    const loadDetail = vi.fn(async (id: string) => ({ ...rows[0], id }));
    const create = vi.fn(async (input: Record<string, unknown>) => ({
      id: "2",
      name: String(input.name),
    }));
    const update = vi.fn(async (id: string, input: Record<string, unknown>) => ({
      id,
      name: String(input.name),
    }));
    const execute = vi.fn(async (row: Row) => {
      row.name = "Actioned";
    });
    const definition = defineAdminResource<Row, Row>({
      key: "example",
      moduleKey: "example.module",
      label: "Example",
      description: "Example resource",
      list: {
        load,
        columns: [{ key: "name", label: "Name", render: (row) => row.name }],
        emptyLabel: "Empty",
        loadingLabel: "Loading",
      },
      detail: { load: loadDetail, create, update },
      actions: [{ key: "action", label: "Action", execute }],
    });
    const controller = new AdminResourceController(definition, undefined);
    const listener = vi.fn();
    controller.subscribe(listener);

    await controller.loadList();
    await controller.loadDetail("1");
    await controller.create({ name: "Created" });
    await controller.update("1", { name: "Updated" }, 1);
    await controller.executeAction(definition.actions![0]!, rows[0]!);

    expect(controller.getSnapshot().loading).toBe(false);
    expect(controller.getSnapshot().pending).toBe(false);
    expect(load).toHaveBeenCalled();
    expect(loadDetail).toHaveBeenCalledWith("1");
    expect(create).toHaveBeenCalledWith({ name: "Created" });
    expect(update).toHaveBeenCalledWith("1", { name: "Updated" }, 1);
    expect(execute).toHaveBeenCalledWith(rows[0], undefined);
    expect(listener).toHaveBeenCalled();
  });

  it("exposes failures without throwing into the screen", async () => {
    const definition = defineAdminResource<Row>({
      key: "failing",
      moduleKey: "example.module",
      label: "Failing",
      description: "Failing resource",
      list: {
        load: async () => {
          throw new Error("load failed");
        },
        columns: [],
        emptyLabel: "Empty",
        loadingLabel: "Loading",
      },
    });
    const controller = new AdminResourceController(definition, undefined);

    await controller.loadList();

    expect(controller.getSnapshot().loading).toBe(false);
    expect(controller.getSnapshot().error?.message).toBe("load failed");
  });
});
