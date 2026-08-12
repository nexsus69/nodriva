export interface AttachmentSecurityPolicy {
  maxFileSizeBytes: number;
  maxResourceBytes: number;
  maxUploadsPerHour: number;
  allowedMimeTypes: readonly string[];
}

export const defaultAttachmentSecurityPolicy: AttachmentSecurityPolicy = {
  maxFileSizeBytes: 25 * 1024 * 1024,
  maxResourceBytes: 500 * 1024 * 1024,
  maxUploadsPerHour: 60,
  allowedMimeTypes: ['application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

const signatures: Array<{ mimeType: string; bytes: number[] }> = [
  { mimeType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { mimeType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mimeType: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => (bytes[offset + index] ?? -1) === value);
}

export function detectAttachmentType(
  fileName: string,
  declaredMimeType: string,
  bytes: Uint8Array,
  requestedKind: 'file' | 'image',
  policy: AttachmentSecurityPolicy = defaultAttachmentSecurityPolicy,
): { mimeType: string; kind: 'file' | 'image' } | null {
  const name = fileName.toLowerCase();
  if (/\.(svg|html?|js|mjs|exe|dll|bat|cmd|sh)$/.test(name)) return null;
  const declared = (declaredMimeType.toLowerCase().split(';', 1)[0] ?? '').trim();
  let mimeType: string | undefined;
  for (const signature of signatures) {
    if (startsWith(bytes, signature.bytes) && (signature.mimeType !== 'image/webp' || startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))) {
      mimeType = signature.mimeType;
      break;
    }
  }
  if (!mimeType && /\.(txt|csv|md|log)$/.test(name) && !bytes.includes(0) && ['text/plain', 'text/csv', 'text/markdown'].includes(declared)) mimeType = declared;
  if (!mimeType || !policy.allowedMimeTypes.includes(mimeType)) return null;
  if (declared !== 'application/octet-stream' && declared !== mimeType) return null;
  const kind = mimeType.startsWith('image/') ? 'image' : 'file';
  return kind === requestedKind ? { mimeType, kind } : null;
}
