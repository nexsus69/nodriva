import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ResourceViewRenderer } from './ResourceViewRenderer';

describe('ResourceViewRenderer', () => {
  const view = {
    key: 'customers',
    resource: { resourceType: 'entity' as const, typeKey: 'customer' },
    columns: [{ key: 'name', label: 'Nome' }],
  };

  it('renders metadata-driven columns, rows and actions', () => {
    const markup = renderToStaticMarkup(
      <ResourceViewRenderer
        view={view}
        rows={[{ id: '1', name: 'Acme' }]}
        actions={[{ key: 'edit', label: 'Modifica' }]}
        onAction={vi.fn()}
      />,
    );

    expect(markup).toContain('Nome');
    expect(markup).toContain('Acme');
    expect(markup).toContain('Modifica');
  });

  it('renders a shared empty state', () => {
    const markup = renderToStaticMarkup(<ResourceViewRenderer view={view} rows={[]} />);
    expect(markup).toContain('Nessun elemento presente.');
  });
});
