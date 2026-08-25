import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RelationPicker } from './RelationPicker';

describe('RelationPicker', () => {
  it('renders localized ACL-aware copy through the shared translation catalog', () => {
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

    expect(markup).toContain('Cerca risorse autorizzate');
    expect(markup).toContain('Sono mostrate solo le risorse attive visibili negli scope');
  });
});
