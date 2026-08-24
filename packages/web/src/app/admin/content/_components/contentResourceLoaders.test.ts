/** Verifies scoped content traversal and entity pagination at the Admin boundary. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listChildren: vi.fn(),
  listSubtreeEntities: vi.fn(),
  listMetadata: vi.fn(),
}));

vi.mock("@/app/cache/GlobalCacheClient", () => ({
  AppCache: {
    admin: {
      listChildren: mocks.listChildren,
      listSubtreeEntities: mocks.listSubtreeEntities,
    },
    metadata: { list: mocks.listMetadata },
  },
}));

import { loadAdminEntityRows, loadAdminNodeRows } from "./contentResourceLoaders";

describe("Admin content resource loaders", () => {
  beforeEach(() => {
    mocks.listChildren.mockReset();
    mocks.listSubtreeEntities.mockReset();
    mocks.listMetadata.mockReset();
  });

  it("traverses only the node roots returned by the authorized cache", async () => {
    mocks.listMetadata.mockResolvedValue([{ id: "type-1", name: "Folder" }]);
    mocks.listChildren.mockImplementation((parentId: string | null) => {
      if (parentId === null) return Promise.resolve([{
        id: "root",
        parentId: null,
        path: "root",
        pathLabel: "Root",
        depth: 0,
        nodeTypeId: "type-1",
        name: "Root",
        description: "",
        rowVersion: 1,
      }]);
      return Promise.resolve([]);
    });

    await expect(loadAdminNodeRows()).resolves.toMatchObject([
      { id: "root", typeLabel: "Folder" },
    ]);
    expect(mocks.listChildren).toHaveBeenCalledWith(null);
    expect(mocks.listChildren).toHaveBeenCalledWith("root");
  });

  it("continues entity pagination using the authoritative next cursor", async () => {
    mocks.listMetadata.mockResolvedValue([{ id: "entity-type", name: "Task" }]);
    mocks.listChildren.mockResolvedValue([{ id: "root" }]);
    mocks.listSubtreeEntities
      .mockResolvedValueOnce({
        items: [{
          id: "entity-1",
          parentNodeId: "root",
          entityTypeId: "entity-type",
          name: "First",
          description: "",
          rowVersion: 1,
          nodeName: "Root",
          nodePath: "Root",
        }],
        hasMore: true,
        nextCursor: { path: "root", name: "First", id: "entity-1" },
      })
      .mockResolvedValueOnce({
        items: [{
          id: "entity-2",
          parentNodeId: "root",
          entityTypeId: "entity-type",
          name: "Second",
          description: "",
          rowVersion: 1,
          nodeName: "Root",
          nodePath: "Root",
        }],
        hasMore: false,
      });

    await expect(loadAdminEntityRows()).resolves.toHaveLength(2);
    expect(mocks.listSubtreeEntities).toHaveBeenCalledTimes(2);
    expect(mocks.listSubtreeEntities.mock.calls[1]?.[0]).toMatchObject({
      cursor: { id: "entity-1" },
    });
  });
});
