export type AttachmentScanResult = 'clean' | 'infected';

export interface AttachmentScannerPort {
  scan(content: Uint8Array, context: { fileName: string; mimeType: string }): Promise<AttachmentScanResult>;
}
