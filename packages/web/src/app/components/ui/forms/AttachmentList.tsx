'use client';

import { useCallback, useEffect, useState } from 'react';
import { Skeleton, SkeletonState } from '../feedback';
import { deleteResourceAttachment, listResourceAttachments, type AttachmentItem } from '../../../attachments/attachmentClient';

export interface AttachmentListProps {
  resourceType: 'node' | 'entity';
  resourceId: string;
  fieldKey: string;
  kind: 'file' | 'image';
  tone?: 'dark' | 'light';
  canDelete?: boolean;
}

export function AttachmentList({ resourceType, resourceId, fieldKey, kind, tone = 'dark', canDelete = false }: AttachmentListProps) {
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    void listResourceAttachments(resourceType, resourceId, fieldKey, kind).then(setItems).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Impossibile caricare gli allegati.')).finally(() => setLoading(false));
  }, [fieldKey, kind, resourceId, resourceType]);
  useEffect(() => { refresh(); }, [refresh]);

  if (error) return <p className="text-xs text-rose-400">{error}</p>;
  if (loading) return <SkeletonState label="Caricamento allegati" className="space-y-2">{[0, 1].map((row) => <div key={row} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${tone === 'light' ? 'border-slate-200' : 'border-slate-800'}`}><Skeleton className="h-3 w-2/5" /><Skeleton className="h-3 w-14" /></div>)}</SkeletonState>;
  if (items.length === 0) return <p className="text-xs text-slate-500">Nessun allegato.</p>;

  return <ul className="space-y-2">{items.map((item) => (
    <li key={item.id} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${tone === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/50'}`}>
      <a href={`/api/attachments/${item.id}`} target="_blank" rel="noreferrer" className={`min-w-0 truncate ${tone === 'light' ? 'text-indigo-600 hover:text-indigo-700' : 'text-indigo-300 hover:text-indigo-200'}`}>{item.kind === 'image' ? '🖼️' : '📎'} {item.fileName}</a>
      <div className="flex shrink-0 items-center gap-2 text-slate-500"><span>{Math.ceil(item.sizeBytes / 1024)} KB</span>{canDelete && <button type="button" className={`${tone === 'light' ? 'text-rose-600 hover:text-rose-700' : 'text-rose-400 hover:text-rose-300'}`} onClick={() => { setLoading(true); setError(null); void deleteResourceAttachment(item.id).then(refresh).catch((err: unknown) => { setError(err instanceof Error ? err.message : 'Impossibile eliminare l’allegato.'); setLoading(false); }); }}>Elimina</button>}</div>
    </li>
  ))}</ul>;
}
