import { useLayoutEffect, useRef, useCallback, useState, RefObject } from 'react';

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
  const anchorRef = useRef<{ id: string; absYBefore: number } | null>(null);
  const directionRef = useRef<'forward' | 'backward' | null>(null);

  const [lastCompensation, setLastCompensation] = useState<CompensationInfo | null>(null);

  // ─── Cattura dell'Ancora all'Istante T_1 (Prima del render) ────────────────
  const captureAnchor = useCallback((direction: 'forward' | 'backward') => {
    const container = containerRef.current;
    if (!container) return;

    directionRef.current = direction;

    const containerRect = container.getBoundingClientRect();
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
      
      // Coordinata Y assoluta all'interno dello spazio di scorrimento (scrollTop incluso)
      const absYBefore = targetRowRect.top - containerRect.top + container.scrollTop;

      if (id) {
        anchorRef.current = { id, absYBefore };
      }
    }
  }, [containerRef]);

  // ─── Compensazione in Layout Effect ────────────────────────────────────────
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

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
          
          // Nuova coordinata Y assoluta
          const absYAfter = targetRowRect.top - containerRect.top + container.scrollTop;
          
          // Differenza geometrica assoluta (include la rimozione o l'aggiunta in cima)
          const delta = Math.round(absYAfter - anchorRef.current.absYBefore);

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
  }, [containerRef, items, hasMoreBackward]);

  const resetCompensationInfo = useCallback(() => {
    setLastCompensation(null);
  }, []);

  return {
    captureAnchor,
    lastCompensation,
    resetCompensationInfo,
  };
}
