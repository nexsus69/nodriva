'use client';

import { useEffect } from 'react';
import { CacheGarbageCollector } from '../cache/CacheGarbageCollector';

export function CacheInitializer() {
  useEffect(() => {
    // Avvio del Garbage Collector delle view semantiche (idempotente)
    // Esegue sweep ogni 30s usando i default
    CacheGarbageCollector.start(30000);

    return () => {
      CacheGarbageCollector.stop();
    };
  }, []);

  return null;
}
