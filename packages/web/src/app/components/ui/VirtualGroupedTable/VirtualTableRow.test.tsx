import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../hooks/useCacheEntity', () => ({
  useCacheEntity: () => ({ data: null }),
}));
vi.mock('../../LockIndicator', () => ({
  LockIndicator: () => <span data-lock-indicator="true" />,
}));

import { VirtualTableRow } from './VirtualTableRow';

describe('VirtualTableRow responsive rendering', () => {
  it('keeps desktop grid and mobile card representations in the same row', () => {
    const markup = renderToStaticMarkup(
      <VirtualTableRow
        item={{ id: 'entity-1', name: 'Alpha', status: 'Aperta' }}
        columns={[
          { key: 'name', header: 'Nome', render: (item) => <strong>{item.name}</strong> },
          { key: 'status', header: 'Stato' },
        ]}
        isSelected
        onToggleSelect={vi.fn()}
        renderActions={({ item }) => <button>Apri {item.id}</button>}
        gridTemplateColumns="32px 32px 2fr 1fr 120px"
      />,
    );

    expect(markup).toContain('data-row-id="entity-1"');
    expect(markup).toContain('md:grid');
    expect(markup).toContain('md:hidden');
    expect(markup).toContain('grid-template-columns:32px 32px 2fr 1fr 120px');
    expect(markup).toContain('Stato');
    expect(markup).toContain('Aperta');
    expect(markup.match(/Alpha/g)).toHaveLength(2);
  });
});
