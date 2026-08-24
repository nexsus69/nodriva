/** Verifies reusable administrative resource definitions and validation. */
import { describe, expect, it, vi } from "vitest";
import { canUseAdminResourceOperation, defineAdminResource } from "./AdminResourceDefinition";

type Row = { id: string; name: string };

describe("AdminResourceDefinition", () => {
  it("preserves the typed list, detail, action, and surface contract", () => {
    const load = vi.fn().mockResolvedValue([] as readonly Row[]);
    const resource = defineAdminResource<Row>({
      key: "example",
      moduleKey: "example.module",
      label: "Example",
      description: "Example resource",
      list: {
        load,
        columns: [{ key: "name", label: "Name", render: (row) => row.name }],
        emptyLabel: "No examples",
        loadingLabel: "Loading examples",
      },
      actions: [
        {
          key: "refresh",
          label: "Refresh",
          execute: vi.fn(),
        },
      ],
      surfaces: [],
    });

    expect(resource.key).toBe("example");
    expect(resource.list.load).toBe(load);
    expect(resource.list.columns[0]?.render({ id: "1", name: "A" })).toBe("A");
  });

  it("rejects duplicate columns and surfaces at definition time", () => {
    expect(() =>
      defineAdminResource({
        key: "invalid-columns",
        moduleKey: "example.module",
        label: "Example",
        description: "Example resource",
        list: {
          load: async () => [],
          columns: [
            { key: "name", label: "Name", render: () => null },
            { key: "name", label: "Name again", render: () => null },
          ],
          emptyLabel: "No examples",
          loadingLabel: "Loading examples",
        },
      }),
    ).toThrow("duplicate list columns");
  });

  it("enforces declared operation permissions through one evaluator", () => {
    const resource = defineAdminResource<Row>({
      key: "secured",
      moduleKey: "secured.module",
      label: "Secured",
      description: "Secured resource",
      permissions: { read: ["resource.read"], update: ["resource.update"] },
      list: {
        load: async () => [],
        columns: [],
        emptyLabel: "Empty",
        loadingLabel: "Loading",
      },
    });

    expect(canUseAdminResourceOperation(resource, "read", new Set(["resource.read"]))).toBe(true);
    expect(canUseAdminResourceOperation(resource, "update", new Set(["resource.read"]))).toBe(false);
    expect(canUseAdminResourceOperation(resource, "create", new Set())).toBe(true);
  });
});
