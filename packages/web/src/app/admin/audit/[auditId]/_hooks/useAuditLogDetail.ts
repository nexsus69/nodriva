'use client';

import { useEffect, useState } from 'react';
import type { ApiErrorResponse, AuditLogDetailDto } from '@dashboard/core';
import { AppCache } from '../../../../cache/GlobalCacheClient';

export function useAuditLogDetail(auditId: string) {
  const [log, setLog] = useState<AuditLogDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  useEffect(() => {
    if (!auditId) return;
    let cancelled = false;
    void AppCache.admin.getAuditLogById(auditId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) setLog(result.data);
      else if (result.error) setError(result.error);
      else setError({ message: 'Evento di audit non trovato.', code: 'AUDIT_LOG_NOT_FOUND' });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [auditId]);

  return { log, loading, error };
}
