/** Verifies the reusable node tree model and its form control markup. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildFormTree, NodeTreeSelect } from "./NodeTreeSelect";

/** Provides a child before its parent to exercise order-independent grouping. */
const nodes = [
  { id: "child", parentId: "root", name: "Child", pathLabel: "Root / Child" },
  { id: "root", parentId: null, name: "Root", pathLabel: "Root" },
];

/** Provides the localized labels required by the generic control. */
const labels = {
  instruction: "Choose a node",
  empty: "No nodes",
  dropPlaceholder: "Drop here",
  expand: "Expand",
  collapse: "Collapse",
  loading: "Loading nodes",
};

describe("NodeTreeSelect", () => {
  it("builds a hierarchy independently from input order", () => {
    expect(buildFormTree(nodes)).toEqual([
      {
        ...nodes[1],
        children: [{ ...nodes[0], children: [] }],
      },
    ]);
  });

  it("renders a definition-driven tree and drop target", () => {
    const markup = renderToStaticMarkup(
      <NodeTreeSelect
        id="node"
        name="nodeId"
        value=""
        nodes={nodes}
        labels={labels}
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('data-node-tree-field="nodeId"');
    expect(markup).toContain('role="tree"');
    expect(markup).toContain('data-node-id="root"');
    expect(markup).toContain("data-node-tree-drop-target");
  });

  it("keeps the empty state hidden while the authorized catalogue is loading", () => {
    const markup = renderToStaticMarkup(
      <NodeTreeSelect
        id="node"
        name="nodeId"
        value=""
        nodes={[]}
        labels={labels}
        loading
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Loading nodes");
    expect(markup).not.toContain(">No nodes<");
  });
});
