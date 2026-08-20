import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeTree } from './NodeTree';

const mocks = vi.hoisted(() => ({
  nodeLists: new Map<string, { nodes: readonly Record<string, unknown>[]; isLoading: boolean; error: Error | null }>(),
  cachedNodes: new Map<string, Record<string, unknown>>(),
  listCalls: [] as Array<string | null>,
}));

vi.mock('../../hooks/useSemanticNodeList', () => ({
  useSemanticNodeList: (parentId: string | null) => {
    mocks.listCalls.push(parentId);
    return {
      ...(mocks.nodeLists.get(parentId ?? 'root') ?? { nodes: [], isLoading: false, error: null }),
      refresh: vi.fn(),
    };
  },
}));
vi.mock('../../hooks/useCachedNode', () => ({
  useCachedNode: (nodeId: string) => mocks.cachedNodes.get(nodeId) ?? null,
}));
vi.mock('../LockIndicator', () => ({ LockIndicator: () => null }));
vi.mock('../ui/menu', () => ({ NodeResourceMenu: () => null }));
vi.mock('@/app/components/navigation/GuardedLink', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

const rootNode = {
  id: 'root-node',
  name: 'Root node',
  description: '',
  path: 'root',
  depth: 0,
  rowVersion: 1,
};
const childNode = {
  id: 'child-node',
  name: 'Child node',
  description: '',
  path: 'root.child',
  depth: 1,
  rowVersion: 1,
};

describe('NodeTree observable behavior', () => {
  beforeEach(() => {
    mocks.nodeLists.clear();
    mocks.cachedNodes.clear();
    mocks.listCalls.length = 0;
  });

  it('loads children lazily while a branch is collapsed', () => {
    mocks.nodeLists.set('root', { nodes: [rootNode], isLoading: false, error: null });
    mocks.nodeLists.set(rootNode.id, { nodes: [childNode], isLoading: false, error: null });

    const markup = renderToStaticMarkup(<NodeTree />);

    expect(mocks.listCalls).toEqual([null]);
    expect(markup).toContain('Root node');
    expect(markup).not.toContain('Child node');
  });

  it('expands the active path and exposes the selected node', () => {
    mocks.nodeLists.set('root', { nodes: [rootNode], isLoading: false, error: null });
    mocks.nodeLists.set(rootNode.id, { nodes: [childNode], isLoading: false, error: null });

    const markup = renderToStaticMarkup(
      <NodeTree activeNodeId={childNode.id} activeNodePath={childNode.path} />,
    );

    expect(mocks.listCalls).toEqual([null, rootNode.id]);
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Child node');
  });

  it('renders the lazy branch loading state', () => {
    mocks.nodeLists.set('root', { nodes: [rootNode], isLoading: false, error: null });
    mocks.nodeLists.set(rootNode.id, { nodes: [], isLoading: true, error: null });

    const markup = renderToStaticMarkup(
      <NodeTree activeNodeId={childNode.id} activeNodePath={childNode.path} />,
    );

    expect(markup).toContain('Caricamento…');
  });

  it('renders the canonical node updated by the realtime cache', () => {
    mocks.nodeLists.set('root', { nodes: [rootNode], isLoading: false, error: null });
    mocks.cachedNodes.set(rootNode.id, { ...rootNode, name: 'Root updated realtime', rowVersion: 2 });

    const markup = renderToStaticMarkup(<NodeTree />);

    expect(markup).toContain('Root updated realtime');
    expect(markup).not.toContain('>Root node<');
  });
});
