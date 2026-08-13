export interface AttachmentRecord {
  id: string;
  resourceType: 'node' | 'entity';
  resourceId: string;
  fieldKey: string;
  kind: 'file' | 'image';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  checksum: string;
  createdBy: string;
}

export interface AttachmentRepository {
  list(resourceType: AttachmentRecord['resourceType'], resourceId: string, fieldKey?: string): Promise<AttachmentRecord[]>;
  getById(id: string): Promise<AttachmentRecord | null>;
  getResourceQuota(resourceType: AttachmentRecord['resourceType'], resourceId: string): Promise<number>;
  create(record: AttachmentRecord): Promise<void>;
  createWithinQuota(record: AttachmentRecord, maximumResourceBytes: number): Promise<boolean>;
  delete(id: string): Promise<void>;
  deleteForResource(resourceType: AttachmentRecord['resourceType'], resourceId: string): Promise<string[]>;
}
