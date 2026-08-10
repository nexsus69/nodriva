'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteResourceAttachment, listResourceAttachments, type AttachmentItem } from '../../../attachments/attachmentClient';

export interface AttachmentListProps {
  resourceType: 'node' | 'entity';
  resourceId: string;
  canDelete?: boolean;
}

export function AttachmentList({ resourceType, resourceId, canDelete = false }: AttachmentListProps) {
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void listResourceAttachments(resourceType, resourceId).then(setItems).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Impossibile caricare gli allegati.'));
  }, [resourceId, resourceType]);
  useEffect(() => { refresh(); }, [refresh]);

  if (error) return <p className="text-xs text-rose-400">{error}</p>;
  if (items.length === 0) return <p className="text-xs text-slate-500">Nessun allegato.</p>;

  return <ul className="space-y-2">{items.map((item) => (
    <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs">
      <a href={`/api/attachments/${item.id}`} target="_blank" rel="noreferrer" className="min-w-0 truncate text-indigo-300 hover:text-indigo-200">{item.kind === 'image' ? '🖼️' : '📎'} {item.fileName}</a>
      <div className="flex shrink-0 items-center gap-2 text-slate-500"><span>{Math.ceil(item.sizeBytes / 1024)} KB</span>{canDelete && <button type="button" className="text-rose-400 hover:text-rose-300" onClick={() => void deleteResourceAttachment(item.id).then(refresh).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Impossibile eliminare l’allegato.'))}>Elimina</button>}</div>
    </li>
  ))}</ul>;
}
