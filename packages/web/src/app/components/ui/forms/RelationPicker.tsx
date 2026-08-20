'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '../feedback';
import { resolveRelationCandidateAction, searchRelationCandidatesAction, type RelationCandidate } from '../../../actions/relationActions';

interface RelationPickerProps {
  fieldKey: string;
  label: string;
  value: unknown;
  required: boolean;
  resourceType: 'node' | 'entity';
  typeKey: string;
  tone?: 'dark' | 'light';
  onChange: (value: string) => void;
}

export function RelationPicker({ fieldKey, label, value, required, resourceType, typeKey, tone = 'dark', onChange }: RelationPickerProps) {
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<RelationCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const result = await searchRelationCandidatesAction({ resourceType, typeKey, search, limit: 50 });
      if (!cancelled) setCandidates(result);
      if (!cancelled) setLoading(false);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [resourceType, typeKey, search]);

  useEffect(() => {
    const selectedId = typeof value === 'string' ? value : '';
    if (!selectedId || candidates.some((candidate) => candidate.id === selectedId)) return;
    let cancelled = false;
    void resolveRelationCandidateAction({ resourceType, typeKey, resourceId: selectedId }).then((candidate) => {
      if (!cancelled && candidate) setCandidates((current) => [candidate, ...current.filter((item) => item.id !== candidate.id)]);
    });
    return () => { cancelled = true; };
  }, [candidates, resourceType, typeKey, value]);

  return (
    <div className="space-y-1">
      <label htmlFor={`relation-search-${fieldKey}`} className={`mb-1 block text-xs font-medium ${tone === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{label} {required ? '*' : ''}</label>
      <input id={`relation-search-${fieldKey}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca in tutti i nodi autorizzati..." className={`w-full rounded-lg border px-3 py-2 text-xs ${tone === 'light' ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-slate-800 bg-slate-900 text-slate-100'}`} />
      {loading ? <span role="status" aria-label={`Caricamento opzioni per ${label}`}><Skeleton className="h-9 w-full" /></span> : <select required={required} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-xs ${tone === 'light' ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-slate-800 bg-slate-900 text-slate-100'}`}>
        <option value="">Seleziona una risorsa autorizzata</option>
        {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.pathLabel ? ` — ${candidate.pathLabel}` : ''}</option>)}
      </select>}
      <p className="text-[10px] text-slate-500">Sono mostrate solo risorse attive visibili secondo gli scope dell&apos;utente.</p>
    </div>
  );
}
