'use client';

import { useCallback, useState } from 'react';
import { toggleNodeExpansion } from './nodeTreeModel';

export function useNodeTreeController() {
  const [expandedNodeIds, setExpandedNodeIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodeIds((current) => toggleNodeExpansion(current, nodeId));
  }, []);

  return { expandedNodeIds, toggleNode };
}
