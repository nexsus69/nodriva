/** Verifies the reusable identity fields composed by node and entity resource forms. */
import { describe, expect, it } from 'vitest';
import { buildResourceIdentityFields } from './ResourceFormDefinition';

describe('buildResourceIdentityFields', () => {
  it('creates a configurable type selector and responsive standard identity fields', () => {
    expect(buildResourceIdentityFields({
      type: {
        name: 'typeKey',
        label: 'Type',
        options: [{ value: 'project', label: 'Project' }],
      },
      nameLabel: 'Name',
      descriptionLabel: 'Description',
    })).toEqual([
      {
        name: 'typeKey',
        type: 'select',
        label: 'Type',
        required: true,
        options: [{ value: 'project', label: 'Project' }],
        layout: { row: 'identity', colSpan: 1, order: 1 },
      },
      {
        name: 'name',
        type: 'text',
        label: 'Name',
        required: true,
        layout: { row: 'identity', colSpan: 1, order: 2 },
      },
      {
        name: 'description',
        type: 'textarea',
        label: 'Description',
        rows: 3,
        layout: { row: 'identity', colSpan: 2, order: 3 },
      },
    ]);
  });
});
