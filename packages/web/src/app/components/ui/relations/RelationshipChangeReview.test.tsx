/** Verifies the review summary shown before a relationship mutation is committed. */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RelationshipChangeReview } from './RelationshipChangeReview';

describe('RelationshipChangeReview', () => {
  it('makes a replacement explicit before the user can commit it', () => {
    const markup = renderToStaticMarkup(
      <RelationshipChangeReview
        preview={{
          items: [{
            resourceId: 'source-a',
            kind: 'replace',
            previousTargetIds: ['target-a'],
            nextTargetIds: ['target-b'],
            requiresConfirmation: true,
          }],
          replacementSourceIds: ['source-a'],
          unavailableSourceIds: [],
        }}
        selectedSources={[{
          id: 'source-a',
          name: 'Purchase request 0010',
          resourceType: 'entity',
          parentNodeId: 'node-a',
          pathLabel: 'Operations',
          rowVersion: 3,
        }]}
        pending={false}
        onBack={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(markup).toContain('I collegamenti esistenti verranno sostituiti');
    expect(markup).toContain('Purchase request 0010 — Operations');
    expect(markup).toContain('Conferma sostituzione');
  });
});
