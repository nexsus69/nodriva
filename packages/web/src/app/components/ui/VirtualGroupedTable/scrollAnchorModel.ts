export type ScrollDirection = 'forward' | 'backward';

export interface ScrollAnchor {
  id: string;
  viewportYBefore: number;
}

export interface AnchorRow {
  getAttribute(name: 'data-row-id'): string | null;
  getBoundingClientRect(): Pick<DOMRect, 'top'>;
}

export function captureScrollAnchor(rows: ArrayLike<AnchorRow>, direction: ScrollDirection): ScrollAnchor | null {
  if (rows.length === 0) return null;
  const row = direction === 'forward' ? rows[rows.length - 1] : rows[0];
  const id = row.getAttribute('data-row-id');
  return id ? { id, viewportYBefore: row.getBoundingClientRect().top } : null;
}

export function calculateScrollCompensation(
  anchor: ScrollAnchor,
  viewportYAfter: number,
  direction: ScrollDirection,
  hasMoreBackward: boolean,
): number {
  if (direction === 'forward' && !hasMoreBackward) return 0;
  return Math.round(viewportYAfter - anchor.viewportYBefore);
}
