import { useLayoutEffect, useRef, useCallback, useMemo, useState, RefObject } from 'react';

export interface UseScrollAnchoringOptions<T> {
  containerRef: RefObject<HTMLDivElement | null>;
  items: T[];
  hasMoreBackward: boolean;
}

export interface CompensationInfo {
  timestamp: string;
  delta: number;
  direction: 'forward' | 'backward';
}

/**
 * Strategy: Absolute Y-Coordinate Scroll Anchoring.
 * - Calcola le coordinate assolute degli elementi rispetto allo spazio di scorrimento complessivo (scrollTop incluso).
 * - Questa formula unificata compensa al 100% sia l'inserimento (Scroll UP) che l'eviction (Scroll DOWN).
 * - Conserva intatta l'inerzia e lo scorrimento dell'utente (zero snap-back).
 */
export function useScrollAnchoring<T extends { id: string }>({
  containerRef,
  items,
  hasMoreBackward,
}: UseScrollAnchoringOptions<T>) {
  const anchorRef = useRef<{
    id: string;
    viewportYBefore: number;
  } | null>(null);
  const directionRef = useRef<'forward' | 'backward' | null>(null);

  const [lastCompensation, setLastCompensation] = useState<CompensationInfo | null>(null);
  // L'ancoraggio riguarda la struttura della lista, non gli aggiornamenti dei
  // dati normalizzati che ricreano l'array senza cambiare le righe presenti.
  const itemStructureKey = useMemo(
    () => items.map((item) => item.id).join('\u0000'),
    [items]
  );

  // ─── Cattura dell'Ancora all'Istante T_1 (Prima del render) ────────────────
  const captureAnchor = useCallback((direction: 'forward' | 'backward') => {
    const container = containerRef.current;
    if (!container) return;

    directionRef.current = direction;

    const rowElements = container.querySelectorAll<HTMLElement>('[data-row-id]');
    if (rowElements.length === 0) return;

    let targetRow: HTMLElement | null = null;

    if (direction === 'forward') {
      // Scroll Down con Eviction (taglio in testa): usiamo l'ULTIMA riga come ancora, 
      // poiché siamo sicuri al 100% che sopravviverà al taglio del primo chunk in alto.
      targetRow = rowElements[rowElements.length - 1];
    } else {
      // Scroll Up con Eviction (taglio in coda): usiamo la PRIMA riga come ancora,
      // poiché siamo sicuri al 100% che sopravviverà al taglio dell'ultimo chunk in basso.
      targetRow = rowElements[0];
    }

    if (targetRow) {
      const id = targetRow.getAttribute('data-row-id');
      const targetRowRect = targetRow.getBoundingClientRect();
      
      if (id) {
        // Salviamo la posizione visibile nel viewport. Non usiamo scrollTop:
        // il browser/layout può averlo già corretto tra due commit e rendere
        // nullo un delta assoluto pur avendo spostato visivamente la riga.
        anchorRef.current = {
          id,
          viewportYBefore: targetRowRect.top,
        };
      }
    }
  }, [containerRef]);

  // ─── Compensazione in Layout Effect ────────────────────────────────────────
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (anchorRef.current && directionRef.current) {
      const direction = directionRef.current;
      const shouldCompensate =
        direction === 'backward' || (direction === 'forward' && hasMoreBackward);

      if (shouldCompensate) {
        const prevAnchorEl = container.querySelector<HTMLElement>(
          `[data-row-id="${anchorRef.current.id}"]`
        );
        if (prevAnchorEl) {
          const targetRowRect = prevAnchorEl.getBoundingClientRect();
          
          // Confrontiamo direttamente la posizione della riga nel viewport.
          // Se la rimozione della pagina iniziale l'ha spostata verso l'alto,
          // scrollTop += delta la riporta alla posizione precedente.
          const delta = Math.round(targetRowRect.top - anchorRef.current.viewportYBefore);

          if (delta !== 0) {
            container.scrollTop += delta;
            setLastCompensation({
              timestamp: new Date().toLocaleTimeString(),
              delta,
              direction,
            });
          }
        }
      }

      // Ripristina lo stato dell'ancora
      anchorRef.current = null;
      directionRef.current = null;
    }
  }, [containerRef, itemStructureKey, hasMoreBackward]);

  const resetCompensationInfo = useCallback(() => {
    setLastCompensation(null);
  }, []);

  return {
    captureAnchor,
    lastCompensation,
    resetCompensationInfo,
  };
}
