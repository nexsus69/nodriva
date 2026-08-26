'use client';

/** Presents a reusable, server-calculated relationship change preview. */
import type { IncomingRelationshipMutationPreview, RelationCandidate } from '../../../actions/relationActions';
import { useAppLocale } from '../../../i18n/AppLocaleStore';

interface RelationshipChangeReviewProps {
  preview: IncomingRelationshipMutationPreview;
  selectedSources: readonly RelationCandidate[];
  pending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

/**
 * Keeps the explicit confirmation step presentation-only.
 *
 * The preview is calculated and revalidated on the server; this component
 * never infers a replacement from client-side relation state.
 */
export function RelationshipChangeReview({
  preview,
  selectedSources,
  pending,
  onBack,
  onConfirm,
}: RelationshipChangeReviewProps) {
  const { t } = useAppLocale();
  const sourcesById = new Map(selectedSources.map((source) => [source.id, source]));
  const changedItems = preview.items.filter((item) => item.kind !== 'no_change');
  const replacementItems = preview.items.filter((item) => item.requiresConfirmation);
  const hasUnavailableSource = preview.unavailableSourceIds.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {t('relation.reviewTitle', 'Review relationship changes')}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {t(
            'relation.reviewDescription',
            'The server will verify these resources again when you confirm.',
          )}
        </p>
      </div>

      <p className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        {t('relation.changedCount', '{count} resources will be changed.').replace(
          '{count}',
          String(changedItems.length),
        )}
      </p>

      {replacementItems.length > 0 && (
        <section className="border border-amber-200 bg-amber-50 p-3" aria-labelledby="relationship-replacements-title">
          <h4 id="relationship-replacements-title" className="text-xs font-semibold text-amber-950">
            {t('relation.replacementTitle', 'Existing links will be replaced')}
          </h4>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            {t(
              'relation.replacementDescription',
              'Each listed resource currently points to another record. Confirming replaces that value with this record.',
            )}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-950">
            {replacementItems.map((item) => (
              <li key={item.resourceId}>
                {sourceLabel(sourcesById.get(item.resourceId), item.resourceId)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasUnavailableSource && (
        <p role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
          {t(
            'relation.concurrentChangeWarning',
            'One or more selected resources are currently edited elsewhere. Wait and review the selection again.',
          )}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
        >
          {t('relation.backToSelection', 'Back to selection')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending || changedItems.length === 0 || hasUnavailableSource}
          className="bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending
            ? t('relation.saving', 'Saving links…')
            : replacementItems.length > 0
              ? t('relation.confirmReplacement', 'Confirm replacement')
              : t('relation.confirmChanges', 'Confirm changes')}
        </button>
      </div>
    </div>
  );
}

function sourceLabel(source: RelationCandidate | undefined, fallbackId: string): string {
  return source?.pathLabel ? `${source.name} — ${source.pathLabel}` : source?.name ?? fallbackId;
}
