'use client';

/** Renders a reusable relation selector with scoped asynchronous candidates. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  resolveRelationCandidateAction,
  searchRelationCandidatesAction,
  type RelationCandidate,
} from '../../../actions/relationActions';
import { Skeleton } from '../feedback';
import { CustomSelect } from './CustomSelect';
import { useAppLocale } from '../../../i18n/AppLocaleStore';

interface RelationPickerProps {
  fieldKey: string;
  label: string;
  value: unknown;
  required: boolean;
  resourceType: 'node' | 'entity';
  typeKey: string;
  tone?: 'dark' | 'light';
  onChange: (value: string | string[]) => void;
  showLabel?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  onResolvedCandidatesChange?: (candidates: RelationCandidate[]) => void;
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
  multiple = false,
  onResolvedCandidatesChange,
}: RelationPickerProps) {
  const { t } = useAppLocale();
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
          setError(t('relation.loadCandidatesError', 'Unable to load relationship resources. Try again.'));
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
  }, [resourceType, search, t, typeKey]);

  const selectedIds = useMemo(
    () => multiple
      ? (Array.isArray(value) ? value.filter((candidate): candidate is string => typeof candidate === 'string') : [])
      : (typeof value === 'string' && value ? [value] : []),
    [multiple, value],
  );

  useEffect(() => {
    const missingIds = selectedIds.filter((selectedId) => !candidates.some((candidate) => candidate.id === selectedId));
    if (missingIds.length === 0) {
      return;
    }
    let cancelled = false;
    void Promise.all(missingIds.map(async (resourceId) => resolveRelationCandidateAction({
      resourceType,
      typeKey,
      resourceId,
    }))).then((resolved) => {
      if (!cancelled) {
        setCandidates((current) => [
          ...resolved.filter((candidate): candidate is RelationCandidate => candidate !== null),
          ...current.filter((item) => !resolved.some((candidate) => candidate?.id === item.id)),
        ]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [candidates, resourceType, selectedIds, typeKey]);

  const selectedIdsKey = selectedIds.join('|');
  useEffect(() => {
    if (!onResolvedCandidatesChange) return;
    const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    onResolvedCandidatesChange(
      selectedIds
        .map((selectedId) => candidatesById.get(selectedId))
        .filter((candidate): candidate is RelationCandidate => candidate !== undefined),
    );
  }, [candidates, onResolvedCandidatesChange, selectedIds, selectedIdsKey]);

  const toggleCandidate = (candidateId: string) => {
    if (multiple) {
      onChange(selectedIds.includes(candidateId)
        ? selectedIds.filter((selectedId) => selectedId !== candidateId)
        : [...selectedIds, candidateId]);
      return;
    }
    onChange(candidateId);
  };

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
        placeholder={t('relation.searchPlaceholder', 'Search authorized resources…')}
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
      ) : multiple ? (
        <div className={`max-h-48 space-y-1 overflow-y-auto rounded-lg border p-1 ${
          tone === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900'
        }`}>
          {candidates.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-500">
              {t('relation.noCandidates', 'No resources are available.')}
            </p>
          ) : candidates.map((candidate) => {
            const selected = selectedIds.includes(candidate.id);
            return (
              <button
                key={candidate.id}
                type="button"
                role="checkbox"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => toggleCandidate(candidate.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? 'bg-indigo-100 text-indigo-900'
                    : tone === 'light'
                      ? 'text-slate-700 hover:bg-slate-50'
                      : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span aria-hidden="true" className={`inline-flex size-4 items-center justify-center border text-[10px] ${
                  selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 text-transparent'
                }`}>
                  ✓
                </span>
                <span className="min-w-0 truncate">
                  {candidate.name}{candidate.pathLabel ? ` — ${candidate.pathLabel}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <CustomSelect
          id={`relation-select-${fieldKey}`}
          disabled={disabled}
          required={required}
          value={String(value ?? '')}
          tone={tone}
          placeholder={t('relation.selectPlaceholder', 'Select an authorized resource')}
          options={candidates.map((candidate) => ({
            value: candidate.id,
            label: `${candidate.name}${
              candidate.pathLabel ? ` — ${candidate.pathLabel}` : ''
            }`,
          }))}
          onChange={toggleCandidate}
        />
      )}
      {error && (
        <p role="alert" className="text-[10px] text-rose-500">
          {error}
        </p>
      )}
      <p className="text-[10px] text-slate-500">
        {t(
          'relation.scopeHelp',
          'Only active resources visible in the user scopes are shown.',
        )}
      </p>
    </div>
  );
}
