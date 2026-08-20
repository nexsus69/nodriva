import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { UserCreateForm } from './UserCreateForm';

const baseProps = {
  values: { email: '', password: '', isSuperAdmin: false },
  scopes: [],
  selectedScopeIds: [],
  formError: null,
  isPending: false,
  onChange: vi.fn(),
  onScopeToggle: vi.fn(),
  onRetryScopes: vi.fn(),
  onSubmit: vi.fn(),
} as const;

describe('UserCreateForm scope loading', () => {
  it('blocks submission and offers retry after an infrastructure failure', () => {
    const markup = renderToStaticMarkup(
      <UserCreateForm
        {...baseProps}
        scopeLoadState="failed"
        scopeLoadError={{ code: 'INTERNAL_ERROR', message: 'Servizio non disponibile.' }}
      />,
    );

    expect(markup).toContain('Servizio non disponibile.');
    expect(markup).toContain('Riprova');
    expect(markup).toMatch(/type="submit" disabled=""/);
  });

  it('allows normal account creation after an explicit scope permission denial', () => {
    const markup = renderToStaticMarkup(
      <UserCreateForm
        {...baseProps}
        scopeLoadState="restricted"
        scopeLoadError={null}
      />,
    );

    expect(markup).toContain('Puoi creare un account senza scope.');
    expect(markup).not.toMatch(/type="submit" disabled=""/);
  });
});
