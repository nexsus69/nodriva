export interface StoredAttachment {
  storageKey: string;
  checksum: string;
  sizeBytes: number;
}

export interface AttachmentStoragePort {
  put(storageKey: string, content: Uint8Array): Promise<StoredAttachment>;
  get(storageKey: string): Promise<Uint8Array | null>;
  delete(storageKey: string): Promise<void>;
}
