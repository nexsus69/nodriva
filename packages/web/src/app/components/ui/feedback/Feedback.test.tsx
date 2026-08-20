import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Skeleton, SkeletonState } from './Feedback';

describe('SkeletonState', () => {
  it('keeps accessibility separate from component-owned skeleton geometry', () => {
    const markup = renderToStaticMarkup(<SkeletonState label="Caricamento entità"><Skeleton className="h-8 w-24" /></SkeletonState>);

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Caricamento entità"');
    expect(markup).toContain('motion-safe:animate-pulse');
    expect(markup).toContain('bg-slate-200');
    expect(markup).toContain('h-8 w-24');
    expect(markup).not.toContain('>Caricamento entità<');
  });
});
