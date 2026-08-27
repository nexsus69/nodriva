// Purpose: verifies every canonical resource menu exposes its soft-delete action without a detail-page callback.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/workspace',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('./Menu', () => ({
  OverflowMenu: ({ items }: { items: readonly { id: string; label: string }[] }) => (
    <div>{items.map((item) => <span key={item.id}>{item.label}</span>)}</div>
  ),
}));

vi.mock('./useResourceMenuDelete', () => ({
  useResourceMenuDelete: () => ({ requestDelete: vi.fn(), isDeleting: false, errorMessage: null }),
}));

import { EntityResourceMenu, NodeResourceMenu } from './ResourceMenus';

describe('ResourceMenus', () => {
  it('always exposes node deletion from a generic node menu', () => {
    const markup = renderToStaticMarkup(<NodeResourceMenu nodeId="node-1" nodeName="Nodo" />);

    expect(markup).toContain('Elimina nodo');
  });

  it('always exposes entity deletion from a generic entity menu', () => {
    const markup = renderToStaticMarkup(<EntityResourceMenu entityId="entity-1" entityName="Attività" parentNodeId="node-1" />);

    expect(markup).toContain('Elimina entità');
  });
});
