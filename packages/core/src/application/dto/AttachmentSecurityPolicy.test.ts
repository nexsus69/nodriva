import { describe, expect, it } from 'vitest';
import { detectAttachmentType } from './AttachmentSecurityPolicy.js';

describe('detectAttachmentType', () => {
  it('accepts a PDF only when its signature matches', () => {
    expect(detectAttachmentType('report.pdf', 'application/pdf', new TextEncoder().encode('%PDF-1.7'), 'file')).toEqual({ mimeType: 'application/pdf', kind: 'file' });
    expect(detectAttachmentType('report.pdf', 'application/pdf', new TextEncoder().encode('<html>'), 'file')).toBeNull();
  });

  it('rejects unsafe extensions, MIME mismatches and kind mismatches', () => {
    expect(detectAttachmentType('page.svg', 'image/svg+xml', new TextEncoder().encode('<svg/>'), 'image')).toBeNull();
    expect(detectAttachmentType('image.png', 'image/jpeg', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image')).toBeNull();
    expect(detectAttachmentType('image.png', 'image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'file')).toBeNull();
  });
});
