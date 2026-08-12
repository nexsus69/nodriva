import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RelationPicker } from './RelationPicker';

describe('RelationPicker', () => {
  it('renders a cross-node search control with ACL-aware wording', () => {
    const markup = renderToStaticMarkup(
      <RelationPicker
        fieldKey="related_document"
        label="Related document"
        value=""
        required={false}
        resourceType="entity"
        typeKey="managed_document"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('Cerca in tutti i nodi autorizzati');
    expect(markup).toContain('Sono mostrate solo risorse attive visibili secondo gli scope');
  });
});
