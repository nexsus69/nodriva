"use client";

import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from "react";
import type {
  FormNodeTreeLabels,
  FormTreeNodeOption,
} from "./FormDefinition";

/** Represents one node with its recursively nested visible children. */
export interface FormTreeBranch extends FormTreeNodeOption {
  children: readonly FormTreeBranch[];
}

/** Groups flat node options into a deterministic hierarchy. */
export function buildFormTree(
  nodes: readonly FormTreeNodeOption[],
): readonly FormTreeBranch[] {
  const knownIds = new Set(nodes.map((node) => node.id));
  const childrenByParent = new Map<string | null, FormTreeNodeOption[]>();

  for (const node of nodes) {
    const parentId = node.parentId && knownIds.has(node.parentId)
      ? node.parentId
      : null;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(node);
    childrenByParent.set(parentId, children);
  }

  /** Builds one branch while protecting the renderer from malformed cycles. */
  const buildBranch = (
    node: FormTreeNodeOption,
    ancestors: ReadonlySet<string>,
  ): FormTreeBranch => {
    if (ancestors.has(node.id)) return { ...node, children: [] };
    const nextAncestors = new Set(ancestors).add(node.id);
    const children = [...(childrenByParent.get(node.id) ?? [])]
      .sort(compareTreeNodes)
      .map((child) => buildBranch(child, nextAncestors));
    return { ...node, children };
  };

  return [...(childrenByParent.get(null) ?? [])]
    .sort(compareTreeNodes)
    .map((node) => buildBranch(node, new Set()));
}

/** Sorts sibling nodes by their human-readable path and stable identifier. */
function compareTreeNodes(
  left: FormTreeNodeOption,
  right: FormTreeNodeOption,
): number {
  return left.pathLabel.localeCompare(right.pathLabel) ||
    left.id.localeCompare(right.id);
}

/** Renders a reusable single-node form control with direct and drag selection. */
export function NodeTreeSelect({
  id,
  name,
  value,
  nodes,
  labels,
  interaction = "both",
  disabled = false,
  required = false,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  nodes: readonly FormTreeNodeOption[];
  labels: FormNodeTreeLabels;
  interaction?: "drag-drop" | "direct" | "both";
  disabled?: boolean;
  required?: boolean;
  onChange: (nodeId: string) => void;
}) {
  const tree = useMemo(() => buildFormTree(nodes), [nodes]);
  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [dragActive, setDragActive] = useState(false);
  const pointerNodeId = useRef<string | null>(null);
  const selectedNode = nodes.find((node) => node.id === value);
  const directSelectionEnabled = interaction !== "drag-drop";
  const dragSelectionEnabled = interaction !== "direct";

  /** Toggles one branch without changing the selected form value. */
  const toggleBranch = (nodeId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  /** Starts a standards-compatible drag carrying the canonical node ID. */
  const startDrag = (
    event: DragEvent<HTMLButtonElement>,
    nodeId: string,
  ) => {
    if (!dragSelectionEnabled || disabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-nodriva-node", nodeId);
    event.dataTransfer.setData("text/plain", nodeId);
  };

  /** Starts a pointer-based drag that also works in scrollable and touch UIs. */
  const startPointerSelection = (nodeId: string) => {
    if (dragSelectionEnabled && !disabled) pointerNodeId.current = nodeId;
  };

  /** Completes a pointer-based drop without relying on DataTransfer support. */
  const dropPointerNode = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nodeId = pointerNodeId.current;
    pointerNodeId.current = null;
    setDragActive(false);
    if (!disabled && nodeId && nodeIds.has(nodeId)) onChange(nodeId);
  };

  /** Accepts only IDs belonging to the field's declared node catalogue. */
  const dropNode = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const nodeId = event.dataTransfer.getData("application/x-nodriva-node") ||
      event.dataTransfer.getData("text/plain");
    if (nodeIds.has(nodeId)) onChange(nodeId);
  };

  /** Renders one recursive branch using the ARIA tree contract. */
  const renderBranch = (branch: FormTreeBranch) => {
    const hasChildren = branch.children.length > 0;
    const expanded = !collapsedIds.has(branch.id);
    const selected = branch.id === value;

    return (
      <li
        key={branch.id}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={selected}
      >
        <div className="flex min-w-0 items-center gap-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleBranch(branch.id)}
              disabled={disabled}
              aria-label={`${expanded ? labels.collapse : labels.expand}: ${branch.name}`}
              className="size-6 shrink-0 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              {expanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="block size-6 shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            draggable={dragSelectionEnabled && !disabled}
            disabled={disabled}
            data-node-id={branch.id}
            onDragStart={(event) => startDrag(event, branch.id)}
            onPointerDown={() => startPointerSelection(branch.id)}
            onClick={() => {
              pointerNodeId.current = null;
              if (directSelectionEnabled) onChange(branch.id);
            }}
            className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-xs disabled:opacity-50 ${selected ? "bg-indigo-100 font-semibold text-indigo-800" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"}`}
            title={branch.pathLabel}
          >
            {branch.name}
          </button>
        </div>
        {hasChildren && expanded && (
          <ul role="group" className="ml-4 border-l border-slate-200 pl-2">
            {branch.children.map(renderBranch)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div
      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
      data-node-tree-field={name}
      onPointerCancel={() => {
        pointerNodeId.current = null;
        setDragActive(false);
      }}
    >
      <input
        id={id}
        name={name}
        type="hidden"
        value={value}
        required={required}
      />
      <p className="text-xs font-semibold text-slate-700">
        {labels.instruction}
      </p>
      <ul
        role="tree"
        aria-label={labels.instruction}
        className="max-h-64 overflow-auto rounded border border-slate-200 bg-white p-2"
      >
        {tree.map(renderBranch)}
        {tree.length === 0 && (
          <li className="p-2 text-xs text-slate-500">{labels.empty}</li>
        )}
      </ul>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (dragSelectionEnabled && !disabled) setDragActive(true);
        }}
        onDragOver={(event) => {
          if (dragSelectionEnabled && !disabled) event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragActive(false);
          }
        }}
        onDrop={dropNode}
        onPointerEnter={() => {
          if (pointerNodeId.current) setDragActive(true);
        }}
        onPointerLeave={() => {
          if (pointerNodeId.current) setDragActive(false);
        }}
        onPointerUp={dropPointerNode}
        data-node-tree-drop-target
        data-selected-node-id={selectedNode?.id}
        aria-live="polite"
        className={`min-h-14 rounded border-2 border-dashed p-3 text-xs ${dragActive ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-indigo-200 bg-white text-slate-600"}`}
      >
        {selectedNode?.pathLabel ?? labels.dropPlaceholder}
      </div>
    </div>
  );
}
