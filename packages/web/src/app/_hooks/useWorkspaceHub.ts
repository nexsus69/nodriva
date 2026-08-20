'use client';

import { useEffect, useState } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';
import { useSemanticNodeList } from '../hooks/useSemanticNodeList';
import type { ApiErrorResponse } from '@dashboard/core';
import { toClientErrorResponse } from '../errors/clientError';

export function useWorkspaceHub() {
  const [checkingSeed, setCheckingSeed] = useState(true);
  const [databaseSeeded, setDatabaseSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedConfirmation, setSeedConfirmation] = useState('');
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedStatusError, setSeedStatusError] = useState<ApiErrorResponse | null>(null);
  const [seedStatusAttempt, setSeedStatusAttempt] = useState(0);
  const nodeList = useSemanticNodeList(null);

  useEffect(() => {
    let cancelled = false;
    void AppCache.admin.checkDatabaseSeeded().then((seeded) => {
      if (!cancelled) { setDatabaseSeeded(seeded); setCheckingSeed(false); }
    }).catch((reason: unknown) => {
      if (!cancelled) {
        setSeedStatusError(toClientErrorResponse(reason, 'Impossibile verificare lo stato del database.'));
        setCheckingSeed(false);
      }
    });
    return () => { cancelled = true; };
  }, [seedStatusAttempt]);

  const retrySeedStatus = () => {
    setCheckingSeed(true);
    setSeedStatusError(null);
    setSeedStatusAttempt((attempt) => attempt + 1);
  };

  const seedDatabase = async () => {
    setSeeding(true); setSeedError(null);
    try {
      await AppCache.admin.seedDatabase(seedConfirmation);
      setDatabaseSeeded(true);
      window.location.reload();
    } catch (reason) {
      const error = toClientErrorResponse(reason, 'Inizializzazione del database non riuscita.');
      setSeedError(`Errore durante l'inizializzazione del DB: ${error.message}`);
      setSeeding(false);
    }
  };

  return { checkingSeed, databaseSeeded, seedStatusError, retrySeedStatus, seeding, seedConfirmation, setSeedConfirmation, seedError, seedDatabase, ...nodeList };
}
