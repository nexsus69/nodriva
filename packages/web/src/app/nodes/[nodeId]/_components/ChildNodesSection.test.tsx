/** Verifies that the child-node section keeps its loading boundary distinct from its empty state. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChildNodesSection } from './ChildNodesSection';

describe('ChildNodesSection loading boundary', () => {
  it('keeps loading local to the child-node cards without flashing the empty state', () => {
    const markup = renderToStaticMarkup(<ChildNodesSection nodeId="node-1" childNodes={[]} loading canCreate={false} />);

    expect(markup).toContain('aria-label="Caricamento sotto-nodi"');
    expect(markup).toContain('md:grid-cols-3');
    expect(markup).not.toContain('Nessun sotto-nodo figlio presente');
  });
});
