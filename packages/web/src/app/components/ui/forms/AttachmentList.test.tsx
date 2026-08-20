import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AttachmentList } from './AttachmentList';

describe('AttachmentList', () => {
  it('keeps its initial loading state local and uses the requested light palette', () => {
    const markup = renderToStaticMarkup(<AttachmentList resourceType="entity" resourceId="entity-1" fieldKey="documents" kind="file" tone="light" />);
    expect(markup).toContain('aria-label="Caricamento allegati"');
    expect(markup).toContain('border-slate-200');
    expect(markup).not.toContain('Nessun allegato');
    expect(markup).not.toContain('border-slate-800');
  });
});
