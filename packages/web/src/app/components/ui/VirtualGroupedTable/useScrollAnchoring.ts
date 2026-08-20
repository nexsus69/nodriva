import { useLayoutEffect, useRef, useCallback, useMemo, useState, RefObject } from 'react';
import { calculateScrollCompensation, captureScrollAnchor, type ScrollAnchor, type ScrollDirection } from './scrollAnchorModel';

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
  const anchorRef = useRef<ScrollAnchor | null>(null);
  const directionRef = useRef<ScrollDirection | null>(null);

  const [lastCompensation, setLastCompensation] = useState<CompensationInfo | null>(null);
  // L'ancoraggio riguarda la struttura della lista, non gli aggiornamenti dei
  // dati normalizzati che ricreano l'array senza cambiare le righe presenti.
  const itemStructureKey = useMemo(
    () => items.map((item) => item.id).join('\u0000'),
    [items]
  );

  // ─── Cattura dell'Ancora all'Istante T_1 (Prima del render) ────────────────
  const captureAnchor = useCallback((direction: ScrollDirection) => {
    const container = containerRef.current;
    if (!container) return;

    directionRef.current = direction;

    const rowElements = container.querySelectorAll<HTMLElement>('[data-row-id]');
    if (rowElements.length === 0) return;

    // Forward usa l'ultima riga (sopravvive al taglio in testa), backward la
    // prima (sopravvive al taglio in coda).
    anchorRef.current = captureScrollAnchor(rowElements, direction);
  }, [containerRef]);

  // ─── Compensazione in Layout Effect ────────────────────────────────────────
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (anchorRef.current && directionRef.current) {
      const direction = directionRef.current;
      if (direction === 'backward' || hasMoreBackward) {
        const prevAnchorEl = container.querySelector<HTMLElement>(
          `[data-row-id="${anchorRef.current.id}"]`
        );
        if (prevAnchorEl) {
          const delta = calculateScrollCompensation(
            anchorRef.current,
            prevAnchorEl.getBoundingClientRect().top,
            direction,
            hasMoreBackward,
          );

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
