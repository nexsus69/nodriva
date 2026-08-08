'use client';

import React, { ReactNode } from 'react';
import { GroupHeaderSlotProps } from './types';
import { useCachedNode } from '../../../hooks/useCachedNode';
import { LockIndicator } from '../../LockIndicator';
import { OverflowMenu } from '../menu';

interface VirtualGroupHeaderProps {
  nodeId: string;
  nodeName: string;
  nodePath: string;
  nodeDepth: number;
  renderActions?: (props: GroupHeaderSlotProps) => ReactNode;
}

export function VirtualGroupHeader({
  nodeId,
  nodeName,
  nodePath,
  nodeDepth,
  renderActions,
}: VirtualGroupHeaderProps) {
  // The subtree projection already contains every field needed by this
  // header. Requiring a complete node here would create one detail request per
  // group while the tree's children request is still in flight.
  const cachedNode = useCachedNode(nodeId);
  const resolvedNodeName = cachedNode?.name ?? nodeName;
  const resolvedNodePath = cachedNode?.path ?? nodePath;
  const resolvedNodeDepth = cachedNode?.depth ?? nodeDepth;
  // Indentation padding based on depth
  const indentPx = Math.max(0, (resolvedNodeDepth - 1) * 16);

  return (
    <div
      role="rowgroup"
      className="border-y border-indigo-100 bg-indigo-50/70 text-sm font-medium text-slate-700"
    >
      <div
        role="row"
        className="flex items-start justify-between gap-3 px-5 py-2.5"
        style={{ paddingLeft: `${16 + indentPx}px` }}
      >
        <div role="cell" className="min-w-0 flex items-center gap-2 break-words">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-xs font-semibold text-indigo-600">
            ⌂
          </span>
          <span className="min-w-0 whitespace-normal break-words font-semibold leading-5 text-slate-800">{resolvedNodeName}</span>
          <OverflowMenu
            label={`Azioni per ${resolvedNodeName}`}
            items={[{ id: 'open', label: 'Apri nodo', onSelect: () => { window.location.href = `/nodes/${nodeId}`; } }]}
          />
          <span className="hidden truncate text-xs font-mono text-slate-400 sm:inline">
            ({resolvedNodePath})
          </span>
          <LockIndicator resourceType="node" resourceId={nodeId} />
        </div>
        {renderActions && (
          <div role="cell" className="flex items-center gap-2">
            {renderActions({
              nodeName: resolvedNodeName,
              nodePath: resolvedNodePath,
              nodeDepth: resolvedNodeDepth,
            })}
          </div>
        )}
      </div>
    </div>
  );
}
