'use client';

/** Renders the attachment collection owned by the shared targeted lifecycle. */
import { Skeleton, SkeletonState } from '../feedback';
import { useAttachmentCollection } from '../../../attachments/useAttachmentCollection';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
import { MutationFeedback } from '@/app/mutations/MutationFeedback';

export interface AttachmentListProps {
  resourceType: 'node' | 'entity';
  resourceId: string;
  fieldKey: string;
  kind: 'file' | 'image';
  tone?: 'dark' | 'light';
  canDelete?: boolean;
}

export function AttachmentList({ resourceType, resourceId, fieldKey, kind, tone = 'dark', canDelete = false }: AttachmentListProps) {
  const collection = useAttachmentCollection({ resourceType, resourceId, fieldKey, kind });
  const { t } = useAppLocale();

  if (!collection.hasLoaded) return <SkeletonState label={t('attachments.loading')} className="space-y-2">{[0, 1].map((row) => <div key={row} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${tone === 'light' ? 'border-slate-200' : 'border-slate-800'}`}><Skeleton className="h-3 w-2/5" /><Skeleton className="h-3 w-14" /></div>)}</SkeletonState>;
  if (collection.items.length === 0 && !collection.error) return <p className="text-xs text-slate-500">{t('attachments.empty')}</p>;

  return <div className="space-y-2">{collection.error && <p role="alert" className="text-xs text-rose-400">{collection.error} <button type="button" className="font-semibold underline" onClick={() => void collection.refresh()}>{t('common.retry')}</button></p>}{collection.mutationFailure && <MutationFeedback failure={collection.mutationFailure} onRetry={collection.retryMutation} />}<ul className="space-y-2">{collection.items.map((item) => (
    <li key={item.id} aria-busy={collection.pendingDeletionIds.has(item.id)} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${tone === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/50'}`}>
      <a href={`/api/attachments/${item.id}`} target="_blank" rel="noreferrer" className={`min-w-0 truncate ${tone === 'light' ? 'text-indigo-600 hover:text-indigo-700' : 'text-indigo-300 hover:text-indigo-200'}`}>{item.kind === 'image' ? '🖼️' : '📎'} {item.fileName}</a>
      <div className="flex shrink-0 items-center gap-2 text-slate-500"><span>{Math.ceil(item.sizeBytes / 1024)} KB</span>{canDelete && <button type="button" disabled={collection.pendingDeletionIds.has(item.id)} className={`${tone === 'light' ? 'text-rose-600 hover:text-rose-700' : 'text-rose-400 hover:text-rose-300'} disabled:opacity-60`} onClick={() => void collection.remove(item)}>{collection.pendingDeletionIds.has(item.id) ? t('attachments.deleting') : t('attachments.delete')}</button>}</div>
    </li>
  ))}</ul></div>;
}
