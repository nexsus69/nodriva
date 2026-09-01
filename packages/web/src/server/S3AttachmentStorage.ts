import { createHash } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AttachmentStoragePort, StoredAttachment } from '@dashboard/core';
import { AttachmentContentCryptor } from './AttachmentContentCryptor';

export interface S3AttachmentStorageConfiguration {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
  forcePathStyle?: boolean;
  encryptionKey?: string;
  encryptionKeys?: string;
  encryptionActiveVersion?: string;
  requireEncryption?: boolean;
}

/** S3-compatible attachment adapter; works with AWS S3, MinIO and equivalent providers. */
export class S3AttachmentStorage implements AttachmentStoragePort {
  private readonly client: S3Client;
  private readonly cryptor: AttachmentContentCryptor;
  private readonly prefix: string;

  constructor(private readonly configuration: S3AttachmentStorageConfiguration) {
    this.client = new S3Client({ endpoint: configuration.endpoint, region: configuration.region, forcePathStyle: configuration.forcePathStyle ?? true, credentials: { accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey } });
    this.cryptor = new AttachmentContentCryptor(configuration.encryptionKey, configuration.encryptionKeys, configuration.encryptionActiveVersion, configuration.requireEncryption);
    this.prefix = configuration.prefix?.replace(/^\/+|\/+$/g, '') ?? '';
  }

  async put(storageKey: string, content: Uint8Array, options?: { encrypt?: boolean }): Promise<StoredAttachment> {
    const key = this.objectKey(storageKey);
    const payload = this.cryptor.encrypt(content, options?.encrypt ?? false);
    await this.client.send(new PutObjectCommand({ Bucket: this.configuration.bucket, Key: key, Body: payload }));
    return { storageKey, checksum: createHash('sha256').update(content).digest('hex'), sizeBytes: content.byteLength };
  }

  async get(storageKey: string): Promise<Uint8Array | null> {
    try {
      const response = await this.client.send(new GetObjectCommand({ Bucket: this.configuration.bucket, Key: this.objectKey(storageKey) }));
      if (!response.Body) return null;
      return this.cryptor.decrypt(new Uint8Array(await response.Body.transformToByteArray()));
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.configuration.bucket, Key: this.objectKey(storageKey) }));
  }

  private objectKey(storageKey: string): string {
    if (!storageKey || storageKey.startsWith('/') || storageKey.split('/').some((part) => part === '..')) throw new Error('Invalid attachment storage key');
    return this.prefix ? `${this.prefix}/${storageKey}` : storageKey;
  }
}
