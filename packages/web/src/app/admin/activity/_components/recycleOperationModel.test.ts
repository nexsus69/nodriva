/** Verifies that batch consequences never become independently actionable recycle rows. */
import { describe, expect, it } from "vitest";
import { toRecycleOperations } from "./recycleOperationModel";

describe("toRecycleOperations", () => {
  it("keeps one subtree operation and hides descendant nodes and entities", () => {
    const operations = toRecycleOperations([
      { id: "root", name: "Root", path: "Root", deletedAt: "2026-08-29T10:00:00.000Z", deletionBatchId: "batch", rowVersion: 2, isDeletionRoot: true, affectedNodeCount: 2, affectedEntityCount: 1 },
      { id: "child", name: "Child", path: "Root / Child", deletedAt: "2026-08-29T10:00:00.000Z", deletionBatchId: "batch", rowVersion: 2, isDeletionRoot: false, affectedNodeCount: 2, affectedEntityCount: 1 },
    ] as never[], [
      { id: "contained", name: "Contained", entityTypeName: "Document", deletionBatchId: "batch", isSubtreeDeletionDescendant: true },
      { id: "historical-independent", name: "Historical independent", entityTypeName: "Document", deletionBatchId: null, isSubtreeDeletionDescendant: false, deletedAt: "2026-08-29T11:00:00.000Z", rowVersion: 3 },
      { id: "f03-independent", name: "F-03 independent", entityTypeName: "Document", deletionBatchId: "entity-delete-batch", isSubtreeDeletionDescendant: false, deletedAt: "2026-08-29T12:00:00.000Z", rowVersion: 4 },
    ] as never[]);

    expect(operations).toMatchObject([
      { id: "f03-independent", kind: "entity" },
      { id: "historical-independent", kind: "entity" },
      { id: "root", kind: "node_subtree", affectedNodeCount: 2, affectedEntityCount: 1 },
    ]);
    expect(operations.map((operation) => operation.id)).not.toContain("contained");
  });
});
