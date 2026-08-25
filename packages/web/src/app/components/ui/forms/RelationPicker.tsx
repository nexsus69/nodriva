'use client';

/** Renders a reusable relation selector with scoped asynchronous candidates. */
import { useEffect, useRef, useState } from 'react';
import {
  resolveRelationCandidateAction,
  searchRelationCandidatesAction,
  type RelationCandidate,
} from '../../../actions/relationActions';
import { Skeleton } from '../feedback';
import { CustomSelect } from './CustomSelect';

interface RelationPickerProps {
  fieldKey: string;
  label: string;
  value: unknown;
  required: boolean;
  resourceType: 'node' | 'entity';
  typeKey: string;
  tone?: 'dark' | 'light';
  onChange: (value: string) => void;
  showLabel?: boolean;
  disabled?: boolean;
}

/** Resolves relation candidates while preserving the selected resource after a reload. */
export function RelationPicker({
  fieldKey,
  label,
  value,
  required,
  resourceType,
  typeKey,
  tone = 'dark',
  onChange,
  showLabel = true,
  disabled = false,
}: RelationPickerProps) {
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<RelationCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await searchRelationCandidatesAction({
          resourceType,
          typeKey,
          search,
          limit: 50,
        });
        if (!cancelled && requestVersion.current === version) {
          setCandidates(result);
        }
      } catch {
        if (!cancelled && requestVersion.current === version) {
          setCandidates([]);
          setError('Impossibile caricare le risorse collegate. Riprova.');
        }
      } finally {
        if (!cancelled && requestVersion.current === version) {
          setLoading(false);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [resourceType, typeKey, search]);

  useEffect(() => {
    const selectedId = typeof value === 'string' ? value : '';
    if (!selectedId || candidates.some((candidate) => candidate.id === selectedId)) {
      return;
    }
    let cancelled = false;
    void resolveRelationCandidateAction({
      resourceType,
      typeKey,
      resourceId: selectedId,
    }).then((candidate) => {
      if (!cancelled && candidate) {
        setCandidates((current) => [
          candidate,
          ...current.filter((item) => item.id !== candidate.id),
        ]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [candidates, resourceType, typeKey, value]);

  return (
    <div
      className="space-y-1"
      data-relation-picker={fieldKey}
      aria-busy={loading}
    >
      {showLabel && (
        <label
          htmlFor={`relation-search-${fieldKey}`}
          className={`mb-1 block text-xs font-medium ${
            tone === 'light' ? 'text-slate-700' : 'text-slate-300'
          }`}
        >
          {label} {required ? '*' : ''}
        </label>
      )}
      <input
        id={`relation-search-${fieldKey}`}
        disabled={disabled}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setLoading(true);
          setError(null);
        }}
        placeholder="Cerca in tutti i nodi autorizzati..."
        className={`w-full rounded-lg border px-3 py-2 text-xs ${
          tone === 'light'
            ? 'border-slate-200 bg-slate-50 text-slate-800'
            : 'border-slate-800 bg-slate-900 text-slate-100'
        }`}
      />
      {loading ? (
        <span role="status" aria-label={`Caricamento opzioni per ${label}`}>
          <Skeleton className="h-9 w-full" />
        </span>
      ) : (
        <CustomSelect
          id={`relation-select-${fieldKey}`}
          disabled={disabled}
          required={required}
          value={String(value ?? '')}
          tone={tone}
          placeholder="Seleziona una risorsa autorizzata"
          options={candidates.map((candidate) => ({
            value: candidate.id,
            label: `${candidate.name}${
              candidate.pathLabel ? ` — ${candidate.pathLabel}` : ''
            }`,
          }))}
          onChange={onChange}
        />
      )}
      {error && (
        <p role="alert" className="text-[10px] text-rose-500">
          {error}
        </p>
      )}
      <p className="text-[10px] text-slate-500">
        Sono mostrate solo risorse attive visibili secondo gli scope dell&apos;utente.
      </p>
    </div>
  );
}
