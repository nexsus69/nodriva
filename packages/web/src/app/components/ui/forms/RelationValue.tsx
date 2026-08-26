'use client';

/** Resolves and renders one authorized relationship value without exposing raw identifiers. */

import Link from '@/app/components/navigation/GuardedLink';
import { useEffect, useMemo, useState } from 'react';
import { resolveRelationCandidateAction, type RelationCandidate } from '../../../actions/relationActions';

interface RelationValueProps {
  value: string | readonly string[];
  resourceType: 'node' | 'entity';
  typeKey: string;
}

export function RelationValue({ value, resourceType, typeKey }: RelationValueProps) {
  const [candidates, setCandidates] = useState<readonly RelationCandidate[]>([]);
  const ids = useMemo(() => Array.isArray(value) ? value : [value], [value]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(ids.map((resourceId) => resolveRelationCandidateAction({ resourceType, typeKey, resourceId }))).then((resolved) => {
      if (!cancelled) setCandidates(resolved.filter((candidate): candidate is RelationCandidate => candidate !== null));
    });
    return () => { cancelled = true; };
  }, [ids, resourceType, typeKey]);

  if (candidates.length === 0) return <span>{ids.join(', ')}</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-1">
      {candidates.map((candidate) => {
        if (candidate.resourceType === 'entity' && candidate.parentNodeId) {
          return <Link key={candidate.id} href={`/nodes/${candidate.parentNodeId}/entities/${candidate.id}`} className="text-indigo-600 hover:text-indigo-800">{candidate.name} →</Link>;
        }
        if (candidate.resourceType === 'node') {
          return <Link key={candidate.id} href={`/nodes/${candidate.id}`} className="text-indigo-600 hover:text-indigo-800">{candidate.name} →</Link>;
        }
        return <span key={candidate.id}>{candidate.name}</span>;
      })}
    </span>
  );
}
