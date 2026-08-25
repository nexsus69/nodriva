/** Verifies that every resource form routes values through one draft contract. */
import { describe, expect, it, vi } from 'vitest';
import {
  applyResourceFormDraftChange,
  flattenResourceFormDraft,
} from './ResourceFormDraft';

describe('resource form draft helpers', () => {
  it('flattens stable, dynamic, and attachment values for a shared renderer', () => {
    expect(flattenResourceFormDraft({
      typeKey: 'project',
      name: 'Project A',
      description: 'Example',
      payload: { status: 'open' },
      attachments: { document: [] },
    })).toEqual({
      typeKey: 'project',
      name: 'Project A',
      description: 'Example',
      status: 'open',
      document: [],
    });
  });

  it('routes values to their stable or dynamic draft segment', () => {
    const onTypeKeyChange = vi.fn();
    const onNameChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const onPayloadChange = vi.fn();
    const onAttachmentsChange = vi.fn();
    const bindings = {
      attachmentFieldKeys: new Set(['document']),
      onTypeKeyChange,
      onNameChange,
      onDescriptionChange,
      onPayloadChange,
      onAttachmentsChange,
    };

    applyResourceFormDraftChange('typeKey', 'project', bindings);
    applyResourceFormDraftChange('name', 'Project A', bindings);
    applyResourceFormDraftChange('description', 'Example', bindings);
    applyResourceFormDraftChange('status', 'open', bindings);
    applyResourceFormDraftChange('document', [], bindings);

    expect(onTypeKeyChange).toHaveBeenCalledWith('project');
    expect(onNameChange).toHaveBeenCalledWith('Project A');
    expect(onDescriptionChange).toHaveBeenCalledWith('Example');
    expect(onPayloadChange).toHaveBeenCalledWith('status', 'open');
    expect(onAttachmentsChange).toHaveBeenCalledWith('document', []);
  });
});
