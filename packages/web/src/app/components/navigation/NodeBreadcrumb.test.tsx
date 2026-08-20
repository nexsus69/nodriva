import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeBreadcrumb } from './NodeBreadcrumb';

const mocks = vi.hoisted(() => ({
  result: {
    nodes: [] as Array<Record<string, unknown>>,
    isLoading: false,
    error: null as { code: string; message: string; timestamp: number } | null,
    retry: vi.fn(),
  },
}));

vi.mock('../../hooks/useSemanticNodeBreadcrumb', () => ({
  useSemanticNodeBreadcrumb: () => mocks.result,
}));
vi.mock('../LockIndicator', () => ({ LockIndicator: () => null }));
vi.mock('@/app/components/navigation/GuardedLink', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

describe('NodeBreadcrumb states', () => {
  beforeEach(() => {
    mocks.result.nodes = [];
    mocks.result.isLoading = false;
    mocks.result.error = null;
    mocks.result.retry.mockReset();
  });

  it('shows a skeleton instead of loading copy or the technical node id on cold reload', () => {
    mocks.result.isLoading = true;
    const markup = renderToStaticMarkup(<NodeBreadcrumb nodeId="technical-node-id" />);
    expect(markup).toContain('aria-label="Caricamento breadcrumb"');
    expect(markup).toContain('animate-pulse');
    expect(markup).toContain('w-12');
    expect(markup).toContain('w-16');
    expect(markup).not.toContain('h-3 w-full');
    expect(markup).not.toContain('Catena in caricamento');
    expect(markup).not.toContain('technical-node-id');
  });

  it('renders the hydrated hierarchy and links the parent node from an entity page', () => {
    mocks.result.nodes = [
      { id: 'root', name: 'Root', parentId: null, path: 'root', pathLabel: 'root', depth: 0, nodeTypeId: 'folder', description: '', rowVersion: 1 },
      { id: 'child', name: 'Child', parentId: 'root', path: 'root.child', pathLabel: 'child', depth: 1, nodeTypeId: 'folder', description: '', rowVersion: 1 },
    ];
    const markup = renderToStaticMarkup(<NodeBreadcrumb nodeId="child" currentNodeLinkable />);
    expect(markup).toContain('Root');
    expect(markup).toContain('Child');
    expect(markup).toContain('href="/nodes/child"');
  });

  it('offers retry after an infrastructure failure', () => {
    mocks.result.error = { code: 'INTERNAL_ERROR', message: 'Unavailable', timestamp: Date.now() };
    const markup = renderToStaticMarkup(<NodeBreadcrumb nodeId="child" />);
    expect(markup).toContain('Breadcrumb non disponibile');
    expect(markup).toContain('Riprova');
  });
});
