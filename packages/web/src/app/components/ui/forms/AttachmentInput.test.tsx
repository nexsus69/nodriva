import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentInput } from './AttachmentInput';

describe('AttachmentInput', () => {
  it('renders an image picker with the correct accept filter', () => {
    const markup = renderToStaticMarkup(<AttachmentInput kind="image" onChange={vi.fn()} maxFiles={1} />);
    expect(markup).toContain('type="file"');
    expect(markup).toContain('accept="image/*"');
    expect(markup).not.toContain('multiple=""');
  });
});
