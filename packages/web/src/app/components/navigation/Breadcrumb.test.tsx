import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResponsiveBreadcrumb } from './Breadcrumb';

describe('ResponsiveBreadcrumb', () => {
  it('renders a home icon and keeps the current item accessible', () => {
    const markup = renderToStaticMarkup(<ResponsiveBreadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Nodo molto lungo', href: '/nodes/1' }, { label: 'Entità corrente' }]} />);
    expect(markup).toContain('<svg');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Entità corrente');
    expect(markup).toContain('aria-label="Home"');
  });

  it('collapses intermediate levels in the mobile variant', () => {
    const markup = renderToStaticMarkup(<ResponsiveBreadcrumb items={[{ label: 'Home', href: '/' }, { label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'Current' }]} />);
    expect(markup).toContain('Livelli intermedi nascosti');
    expect(markup).toContain('Current');
  });
});
