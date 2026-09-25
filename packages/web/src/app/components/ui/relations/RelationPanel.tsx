'use client';

/** Presents and mutates incoming resource relationships from shared metadata. */
import { useCallback, useEffect, useState } from 'react';
import Link from '@/app/components/navigation/GuardedLink';
import {
  listIncomingRelationshipsAction,
  mutateIncomingRelationshipAction,
  prepareIncomingRelationshipAction,
  type IncomingRelationshipGroup,
  type IncomingRelationshipMutationPreview,
  type RelationCandidate,
} from '../../../actions/relationActions';
import { AppCache } from '../../../cache/GlobalCacheClient';
import type { ClientEntity, ClientNode } from '../../../types/models';
import { useAppLocale } from '../../../i18n/AppLocaleStore';
import { requestConfirmation, Skeleton } from '../feedback';
import { ModalShell } from '../feedback/ModalShell';
import { RelationPicker } from '../forms/RelationPicker';
import { RelationshipChangeReview } from './RelationshipChangeReview';
import { MutationFeedback } from '@/app/mutations/MutationFeedback';
import { useUserMutation } from '@/app/mutations/useUserMutation';

type ResourceDomain = 'node' | 'entity';

interface RelationPanelProps {
  resourceDomain: ResourceDomain;
  resourceTypeKey: string;
  resourceId: string;
  className?: string;
}

/**
 * A metadata-driven inverse relationship surface for nodes and entities.
 * The parent supplies only the current resource identity; definitions, ACL
 * filtering and mutations remain server-owned.
 */
export function RelationPanel({
  resourceDomain,
  resourceTypeKey,
  resourceId,
  className = '',
}: RelationPanelProps) {
  const { t } = useAppLocale();
  const [groups, setGroups] = useState<IncomingRelationshipGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<IncomingRelationshipGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<RelationCandidate[]>([]);
  const [preview, setPreview] = useState<IncomingRelationshipMutationPreview | null>(null);
  const mutation = useUserMutation();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextGroups = await listIncomingRelationshipsAction({
        targetDomain: resourceDomain,
        targetTypeKey: resourceTypeKey,
        targetResourceId: resourceId,
      });
      if (!nextGroups.success) {
        setError(nextGroups.error.message);
        return;
      }
      setGroups(nextGroups.data);
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : t('relation.loadError', 'Unable to load incoming relationships.'));
    } finally {
      setLoading(false);
    }
  }, [resourceDomain, resourceId, resourceTypeKey, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openGroup = (group: IncomingRelationshipGroup) => {
    setActiveGroup(group);
    setSelectedIds([]);
    setSelectedSources([]);
    setPreview(null);
  };

  const closeGroup = () => {
    if (mutation.pending) return;
    setActiveGroup(null);
    setSelectedIds([]);
    setSelectedSources([]);
    setPreview(null);
  };

  const prepareLinks = async () => {
    if (!activeGroup || selectedSources.length === 0) return;
    await mutation.execute(async () => {
      const nextPreview = await prepareIncomingRelationshipAction({
        sourceDomain: activeGroup.definition.sourceDomain,
        sourceTypeKey: activeGroup.definition.sourceTypeKey,
        sourceFieldKey: activeGroup.definition.sourceFieldKey,
        targetDomain: resourceDomain,
        targetResourceId: resourceId,
        operation: 'link',
        sources: selectedSources.map((source) => ({
          resourceId: source.id,
          expectedRowVersion: source.rowVersion,
        })),
      });
      if (!nextPreview.success) throw nextPreview.error;
      return nextPreview.data;
    }, setPreview);
  };

  const commitLinks = async () => {
    if (!activeGroup || !preview || selectedSources.length === 0) return;
    const outcome = await mutation.execute(async () => {
      const result = await AppCache.mutations.run(
        `relationship:${resourceDomain}:${resourceId}`,
        (mutationId) => mutateIncomingRelationshipAction({
          sourceDomain: activeGroup.definition.sourceDomain,
          sourceTypeKey: activeGroup.definition.sourceTypeKey,
          sourceFieldKey: activeGroup.definition.sourceFieldKey,
          targetDomain: resourceDomain,
          targetResourceId: resourceId,
          operation: 'link',
          sources: selectedSources.map((source) => ({ resourceId: source.id, expectedRowVersion: source.rowVersion })),
          acceptedReplacementSourceIds: preview.replacementSourceIds,
          mutationId,
        }),
        (changed) => { if (changed.success) applyRelationshipChanges(changed.data); },
      );
      if (!result.success) throw result.error;
      setActiveGroup(null);
      setSelectedIds([]);
      setSelectedSources([]);
      setPreview(null);
      await load();
    });
    void outcome;
  };

  const unlink = async (group: IncomingRelationshipGroup, source: RelationCandidate) => {
    const confirmed = await requestConfirmation({
      title: t('relation.removeTitle', 'Remove relationship link?'),
      description: t('relation.removeDescription', 'The selected resource will no longer reference this record.'),
      confirmLabel: t('relation.remove', 'Remove link'),
      cancelLabel: t('relation.close', 'Close'),
      tone: 'danger',
    });
    if (!confirmed) return;

    await mutation.execute(async () => {
      const result = await AppCache.mutations.run(
        `relationship:${resourceDomain}:${resourceId}`,
        (mutationId) => mutateIncomingRelationshipAction({
          sourceDomain: group.definition.sourceDomain,
          sourceTypeKey: group.definition.sourceTypeKey,
          sourceFieldKey: group.definition.sourceFieldKey,
          targetDomain: resourceDomain,
          targetResourceId: resourceId,
          operation: 'unlink',
          sources: [{ resourceId: source.id, expectedRowVersion: source.rowVersion }],
          mutationId,
        }),
        (changed) => { if (changed.success) applyRelationshipChanges(changed.data); },
      );
      if (!result.success) throw result.error;
      await load();
    });
  };

  if (!loading && !error && groups.length === 0) return null;

  return (
    <section className={`border border-slate-200 bg-white ${className}`.trim()}>
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {t('relation.incomingTitle', 'Incoming relationships')}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {t('relation.incomingDescription', 'Resources that reference this record.')}
          </p>
        </div>
      </header>

      {error && (
        <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </p>
      )}
      <MutationFeedback failure={mutation.failure} onRetry={() => void mutation.retry()} />

      {loading ? (
        <div className="space-y-3 p-4" role="status" aria-label={t('relation.loading', 'Loading relationships')}>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {groups.map((group) => (
            <RelationshipGroup
              key={group.definition.sourceFieldId}
              group={group}
              disabled={mutation.pending}
              manageLabel={t('relation.manage', 'Manage links')}
              removeLabel={t('relation.remove', 'Remove link')}
              emptyLabel={t('relation.noLinks', 'No linked resources.')}
              cardinalityLabel={group.definition.sourceCardinality === 'many'
                ? t('relation.multipleValues', 'Multiple values')
                : t('relation.singleValue', 'One value')}
              uniqueTargetLabel={t('relation.uniqueTarget', 'Unique target')}
              onManage={() => openGroup(group)}
              onUnlink={(source) => { void unlink(group, source); }}
            />
          ))}
        </div>
      )}

      <ModalShell
        open={activeGroup !== null}
        title={t('relation.linkDialog', 'Manage incoming links')}
        onClose={closeGroup}
        className="max-w-2xl rounded-none"
      >
        {activeGroup && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {activeGroup.definition.inverseLabel
                  || `${activeGroup.definition.sourceTypeName} · ${activeGroup.definition.sourceFieldLabel}`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t('relation.linkHelp', 'Changes are applied atomically to the selected resources.')}
              </p>
            </div>
            {preview ? (
              <RelationshipChangeReview
                preview={preview}
                selectedSources={selectedSources}
                pending={mutation.pending}
                onBack={() => setPreview(null)}
                onConfirm={() => { void commitLinks(); }}
              />
            ) : (
              <>
                <RelationPicker
                  fieldKey={`inverse-${activeGroup.definition.sourceFieldId}`}
                  label={t('relation.addSources', 'Link resources')}
                  value={activeGroup.definition.targetIsUnique ? (selectedIds[0] ?? '') : selectedIds}
                  required={false}
                  resourceType={activeGroup.definition.sourceDomain}
                  typeKey={activeGroup.definition.sourceTypeKey}
                  tone="light"
                  multiple={!activeGroup.definition.targetIsUnique}
                  onChange={(value) => setSelectedIds(
                    Array.isArray(value) ? value : (value ? [value] : []),
                  )}
                  onResolvedCandidatesChange={setSelectedSources}
                />
                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={closeGroup}
                    disabled={mutation.pending}
                    className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
                  >
                    {t('relation.close', 'Close')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { void prepareLinks(); }}
                    disabled={mutation.pending || selectedIds.length === 0 || selectedSources.length !== selectedIds.length}
                    className="bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {mutation.pending
                      ? t('relation.saving', 'Saving links…')
                      : t('relation.reviewChanges', 'Review changes')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </ModalShell>
    </section>
  );
}

function applyRelationshipChanges(
  changed: Array<{ resourceType: 'node' | 'entity'; id: string; [key: string]: unknown }>,
): void {
  changed.forEach((resource) => {
    if (resource.resourceType === 'node') {
      AppCache.nodes.inject(resource.id, resource as Partial<ClientNode> & { id: string }, false, 'mutation:relationship');
      return;
    }
    const entityTypeId = typeof resource.entityTypeId === 'string' ? resource.entityTypeId : null;
    if (entityTypeId) AppCache.getEntityCache(entityTypeId).inject(resource.id, resource as Partial<ClientEntity> & { id: string }, false, 'mutation:relationship');
  });
}

interface RelationshipGroupProps {
  group: IncomingRelationshipGroup;
  disabled: boolean;
  manageLabel: string;
  removeLabel: string;
  emptyLabel: string;
  cardinalityLabel: string;
  uniqueTargetLabel: string;
  onManage: () => void;
  onUnlink: (source: RelationCandidate) => void;
}

/** Renders one inverse field group without owning data or mutation state. */
function RelationshipGroup({
  group,
  disabled,
  manageLabel,
  removeLabel,
  emptyLabel,
  cardinalityLabel,
  uniqueTargetLabel,
  onManage,
  onUnlink,
}: RelationshipGroupProps) {
  const label = group.definition.inverseLabel
    || `${group.definition.sourceTypeName} · ${group.definition.sourceFieldLabel}`;

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-800">{label}</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {cardinalityLabel}
            {group.definition.targetIsUnique ? ` · ${uniqueTargetLabel}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onManage}
          disabled={disabled}
          className="border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
        >
          {manageLabel}
        </button>
      </div>

      {group.linkedSources.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
          {group.linkedSources.map((source) => (
            <li key={source.id} className="flex items-center justify-between gap-3 py-2">
              <Link
                href={source.resourceType === 'node'
                  ? `/nodes/${source.id}`
                  : `/nodes/${source.parentNodeId}/entities/${source.id}`}
                className="min-w-0 truncate text-xs font-medium text-indigo-700 hover:underline"
              >
                {source.name}
                {source.pathLabel ? ` — ${source.pathLabel}` : ''}
              </Link>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onUnlink(source)}
                className="shrink-0 text-xs font-medium text-rose-700 hover:underline disabled:opacity-50"
              >
                {removeLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
