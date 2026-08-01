'use client';

import React, { ReactNode } from 'react';
import { GroupHeaderSlotProps } from './types';
import { useCachedNode } from '../../../hooks/useCachedNode';

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
      className="bg-slate-800/95 border-y border-slate-700/60 text-sm font-medium text-slate-200"
    >
      <div
        role="row"
        className="flex items-center justify-between px-4 py-2.5"
        style={{ paddingLeft: `${16 + indentPx}px` }}
      >
        <div role="cell" className="flex items-center gap-2 truncate">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-500/20 text-indigo-400 text-xs font-semibold">
            📁
          </span>
          <span className="font-semibold text-slate-100">{resolvedNodeName}</span>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline truncate">
            ({resolvedNodePath})
          </span>
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
