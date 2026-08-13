'use client';

import { useEffect, useState } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';
import { useSemanticNodeList } from '../hooks/useSemanticNodeList';

export function useWorkspaceHub() {
  const [checkingSeed, setCheckingSeed] = useState(true);
  const [databaseSeeded, setDatabaseSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedConfirmation, setSeedConfirmation] = useState('');
  const [seedError, setSeedError] = useState<string | null>(null);
  const nodeList = useSemanticNodeList(null);

  useEffect(() => {
    let cancelled = false;
    void AppCache.admin.checkDatabaseSeeded().then((seeded) => {
      if (!cancelled) { setDatabaseSeeded(seeded); setCheckingSeed(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const seedDatabase = async () => {
    setSeeding(true); setSeedError(null);
    try {
      await AppCache.admin.seedDatabase(seedConfirmation);
      setDatabaseSeeded(true);
      window.location.reload();
    } catch (reason) {
      setSeedError(`Errore durante l'inizializzazione del DB: ${reason instanceof Error ? reason.message : 'Errore sconosciuto'}`);
      setSeeding(false);
    }
  };

  return { checkingSeed, databaseSeeded, seeding, seedConfirmation, setSeedConfirmation, seedError, seedDatabase, ...nodeList };
}
