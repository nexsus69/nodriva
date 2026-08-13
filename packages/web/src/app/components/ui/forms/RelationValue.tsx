'use client';

import Link from '@/app/components/navigation/GuardedLink';
import { useEffect, useState } from 'react';
import { resolveRelationCandidateAction, type RelationCandidate } from '../../../actions/relationActions';

interface RelationValueProps {
  value: string;
  resourceType: 'node' | 'entity';
  typeKey: string;
}

export function RelationValue({ value, resourceType, typeKey }: RelationValueProps) {
  const [candidate, setCandidate] = useState<RelationCandidate | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveRelationCandidateAction({ resourceType, typeKey, resourceId: value }).then((resolved) => {
      if (!cancelled) setCandidate(resolved);
    });
    return () => { cancelled = true; };
  }, [resourceType, typeKey, value]);

  if (!candidate) return <span>{value}</span>;
  if (candidate.resourceType === 'entity' && candidate.parentNodeId) {
    return <Link href={`/nodes/${candidate.parentNodeId}/entities/${candidate.id}`} className="text-indigo-300 hover:text-indigo-200">{candidate.name} →</Link>;
  }
  if (candidate.resourceType === 'node') {
    return <Link href={`/nodes/${candidate.id}`} className="text-indigo-300 hover:text-indigo-200">{candidate.name} →</Link>;
  }
  return <span>{candidate.name}</span>;
}
