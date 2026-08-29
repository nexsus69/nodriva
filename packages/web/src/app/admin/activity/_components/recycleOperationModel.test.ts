/** Verifies that batch consequences never become independently actionable recycle rows. */
import { describe, expect, it } from "vitest";
import { toRecycleOperations } from "./recycleOperationModel";

describe("toRecycleOperations", () => {
  it("keeps one subtree operation and hides descendant nodes and entities", () => {
    const operations = toRecycleOperations([
      { id: "root", name: "Root", path: "Root", deletedAt: "2026-08-29T10:00:00.000Z", rowVersion: 2, isDeletionRoot: true, affectedNodeCount: 2, affectedEntityCount: 1 },
      { id: "child", name: "Child", path: "Root / Child", deletedAt: "2026-08-29T10:00:00.000Z", rowVersion: 2, isDeletionRoot: false, affectedNodeCount: 2, affectedEntityCount: 1 },
    ] as never[], [
      { id: "contained", name: "Contained", entityTypeName: "Document", deletionBatchId: "batch" },
      { id: "independent", name: "Independent", entityTypeName: "Document", deletionBatchId: null, deletedAt: "2026-08-29T11:00:00.000Z", rowVersion: 3 },
    ] as never[]);

    expect(operations).toMatchObject([
      { id: "independent", kind: "entity" },
      { id: "root", kind: "node_subtree", affectedNodeCount: 2, affectedEntityCount: 1 },
    ]);
  });
});
