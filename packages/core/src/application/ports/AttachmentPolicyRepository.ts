export type AttachmentEncryptionMode = 'enabled' | 'disabled';
export interface AttachmentPolicyRepository {
  getEncryptionMode(nodeTypeId: string): Promise<AttachmentEncryptionMode>;
  setEncryptionMode(nodeTypeId: string, mode: AttachmentEncryptionMode): Promise<void>;
}
