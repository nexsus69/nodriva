import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./VirtualGroupHeader', () => ({
  VirtualGroupHeader: ({ nodeName }: { nodeName: string }) => <div data-group={nodeName} />,
}));
vi.mock('./VirtualTableRow', () => ({
  VirtualTableRow: ({ item }: { item: { id: string } }) => <div data-row-id={item.id} />,
}));

import { VirtualGroupedTableBody } from './VirtualGroupedTableBody';

const item = { id: 'entity-1', nodeId: 'node-1', nodeName: 'Nodo', nodePath: 'root.node', nodeDepth: 1 };
const columns = [{ key: 'id', header: 'ID' }];

describe('VirtualGroupedTableBody', () => {
  it('keeps error feedback visible together with existing rows', () => {
    const markup = renderToStaticMarkup(
      <VirtualGroupedTableBody
        items={[item]}
        groupedItems={[{ nodeId: 'node-1', nodeName: 'Nodo', nodePath: 'root.node', nodeDepth: 1, items: [item] }]}
        columns={columns}
        isLoading={false}
        isError
        errorMessage="Caricamento fallito"
        onRetry={vi.fn()}
        emptyStateMessage="Vuoto"
        gridTemplateColumns="32px 1fr"
      />,
    );

    expect(markup).toContain('Caricamento fallito');
    expect(markup).toContain('Riprova');
    expect(markup).toContain('data-group="Nodo"');
    expect(markup).toContain('data-row-id="entity-1"');
  });

  it('preserves distinct initial-loading and empty states', () => {
    const loading = renderToStaticMarkup(
      <VirtualGroupedTableBody items={[]} groupedItems={[]} columns={columns} isLoading isError={false} errorMessage="" emptyStateMessage="Vuoto" gridTemplateColumns="32px 1fr" />,
    );
    const empty = renderToStaticMarkup(
      <VirtualGroupedTableBody items={[]} groupedItems={[]} columns={columns} isLoading={false} isError={false} errorMessage="" emptyStateMessage="Vuoto" gridTemplateColumns="32px 1fr" />,
    );

    expect(loading).toContain('aria-label="Caricamento dati tabella"');
    expect(loading).toContain('animate-pulse');
    expect(loading).toContain('grid-template-columns:32px 1fr');
    expect(loading).not.toContain('Caricamento dati in corso');
    expect(loading).not.toContain('Vuoto');
    expect(empty).toContain('Vuoto');
  });
});
