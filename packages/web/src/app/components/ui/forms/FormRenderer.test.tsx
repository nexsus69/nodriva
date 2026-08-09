import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormRenderer } from './FormRenderer';

describe('FormRenderer', () => {
  it('renders schema-driven text and boolean fields', () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[
          { name: 'email', type: 'email', label: 'Email', required: true },
          { name: 'isAdmin', type: 'boolean', label: 'Admin' },
        ]}
        values={{ email: 'user@example.com', isAdmin: true }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).toContain('Email');
    expect(markup).toContain('user@example.com');
    expect(markup).toContain('Admin');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('checked');
  });

  it('renders custom children and pending submit state', () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[]}
        values={{}}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        isPending
        pendingLabel="Creazione..."
      >
        <div>Scope iniziali</div>
      </FormRenderer>,
    );

    expect(markup).toContain('Scope iniziali');
    expect(markup).toContain('Creazione...');
    expect(markup).toContain('disabled');
  });
});
