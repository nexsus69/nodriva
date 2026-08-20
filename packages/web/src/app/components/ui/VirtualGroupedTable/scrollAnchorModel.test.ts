import { describe, expect, it } from 'vitest';
import { calculateScrollCompensation, captureScrollAnchor, type AnchorRow } from './scrollAnchorModel';

function row(id: string, top: number): AnchorRow {
  return {
    getAttribute: () => id,
    getBoundingClientRect: () => ({ top }),
  };
}

describe('scroll anchor model', () => {
  const rows = [row('first', 100), row('middle', 200), row('last', 300)];

  it('anchors the surviving edge for forward and backward window extension', () => {
    expect(captureScrollAnchor(rows, 'forward')).toEqual({ id: 'last', viewportYBefore: 300 });
    expect(captureScrollAnchor(rows, 'backward')).toEqual({ id: 'first', viewportYBefore: 100 });
    expect(captureScrollAnchor([], 'forward')).toBeNull();
  });

  it('compensates insertion and eviction using viewport movement', () => {
    const anchor = { id: 'row', viewportYBefore: 240 };
    expect(calculateScrollCompensation(anchor, 360.4, 'backward', false)).toBe(120);
    expect(calculateScrollCompensation(anchor, 120.4, 'forward', true)).toBe(-120);
  });

  it('does not compensate forward growth until head eviction is possible', () => {
    expect(calculateScrollCompensation({ id: 'row', viewportYBefore: 240 }, 120, 'forward', false)).toBe(0);
  });
});
