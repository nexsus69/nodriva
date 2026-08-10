import { describe, expect, it } from 'vitest';
import { validateAttachmentSelection } from './ResourceAttachment.js';

describe('resource attachments', () => {
  it('validates count, size and MIME type constraints', () => {
    expect(validateAttachmentSelection([
      { name: 'photo.png', type: 'image/png', size: 20 },
      { name: 'manual.pdf', type: 'application/pdf', size: 200 },
    ], { maxFiles: 1, maxSizeBytes: 100, acceptedMimeTypes: ['image/png'] })).toEqual([
      'Sono consentiti al massimo 1 file.',
      'manual.pdf: dimensione massima superata.',
      'manual.pdf: formato non consentito.',
    ]);
  });
});
