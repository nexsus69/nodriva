'use client';

import Link from 'next/link';
import { AppCache } from '../../cache/GlobalCacheClient';
import { useAppCacheRevision } from '../../hooks/useAppCacheRevision';
import { buildCachedBreadcrumbPath } from './nodeBreadcrumbPath';

export interface NodeBreadcrumbProps {
  nodeId: string;
}

export function NodeBreadcrumb({ nodeId }: NodeBreadcrumbProps) {
  const cacheRevision = useAppCacheRevision();
  void cacheRevision;

  const { nodes, isComplete } = buildCachedBreadcrumbPath(
    nodeId,
    (id) => AppCache.nodes.get(id)
  );

  return (
    <nav aria-label="Breadcrumb nodi" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-xs font-mono text-slate-400">
        <li className="shrink-0">
          <Link href="/" className="transition-colors hover:text-slate-200">
            🌐 Workspace
          </Link>
        </li>

        {!isComplete && (
          <>
            <li aria-hidden="true" className="text-slate-600">/</li>
            <li className="text-slate-500" title="Catena degli antenati in caricamento">
              …
            </li>
          </>
        )}

        {nodes.map((node, index) => {
          const isCurrent = index === nodes.length - 1 && node.id === nodeId;
          return (
            <li key={node.id} className="contents">
              <span aria-hidden="true" className="text-slate-600">/</span>
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="truncate font-semibold text-slate-100"
                  title={node.name}
                >
                  {node.name}
                </span>
              ) : (
                <Link
                  href={`/nodes/${node.id}`}
                  className="max-w-48 truncate transition-colors hover:text-indigo-300"
                  title={node.name}
                >
                  {node.name}
                </Link>
              )}
            </li>
          );
        })}

        {nodes.length === 0 && (
          <>
            <li aria-hidden="true" className="text-slate-600">/</li>
            <li className="truncate font-semibold text-slate-300" aria-current="page">
              {nodeId}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
