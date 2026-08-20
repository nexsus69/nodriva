import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../_hooks/useWorkspaceHub', () => ({
  useWorkspaceHub: () => ({
    checkingSeed: false,
    databaseSeeded: false,
    seedStatusError: { code: 'INTERNAL_ERROR', message: 'Verifica temporaneamente non disponibile.' },
    retrySeedStatus: vi.fn(),
    seeding: false,
    seedConfirmation: '',
    setSeedConfirmation: vi.fn(),
    seedError: null,
    seedDatabase: vi.fn(),
    nodes: [],
    isLoading: false,
    error: null,
  }),
}));

import { WorkspaceHubScreen } from './WorkspaceHubScreen';

describe('WorkspaceHubScreen database status failure', () => {
  it('offers retry without presenting the bootstrap form as if the database were empty', () => {
    const markup = renderToStaticMarkup(<WorkspaceHubScreen />);

    expect(markup).toContain('Verifica database non disponibile');
    expect(markup).toContain('Riprova');
    expect(markup).not.toContain('Completa la configurazione iniziale');
  });
});
