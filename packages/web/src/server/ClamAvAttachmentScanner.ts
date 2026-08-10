import net from 'node:net';
import type { AttachmentScannerPort, AttachmentScanResult } from '@dashboard/core';

export class ClamAvAttachmentScanner implements AttachmentScannerPort {
  constructor(
    private readonly host = process.env.CLAMAV_HOST ?? '127.0.0.1',
    private readonly port = Number(process.env.CLAMAV_PORT ?? 3310),
    private readonly timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS ?? 30_000),
  ) {}

  async scan(content: Uint8Array): Promise<AttachmentScanResult> {
    return await new Promise<AttachmentScanResult>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const chunks: Buffer[] = [];
      let settled = false;
      const finish = (error?: Error, result?: AttachmentScanResult) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (error) reject(error);
        else resolve(result as AttachmentScanResult);
      };
      socket.setTimeout(this.timeoutMs, () => finish(new Error('ClamAV scan timed out')));
      socket.on('error', (error) => finish(error));
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('close', () => {
        const response = Buffer.concat(chunks).toString('utf8').trim();
        if (/FOUND\s*\0?$/.test(response)) finish(undefined, 'infected');
        else if (/OK\s*\0?$/.test(response)) finish(undefined, 'clean');
        else finish(new Error(`Unexpected ClamAV response: ${response.slice(0, 200)}`));
      });
      socket.on('connect', () => {
        socket.write(Buffer.from('zINSTREAM\0'));
        const chunkSize = 1024 * 1024;
        for (let offset = 0; offset < content.byteLength; offset += chunkSize) {
          const chunk = content.subarray(offset, Math.min(offset + chunkSize, content.byteLength));
          const length = Buffer.allocUnsafe(4);
          length.writeUInt32BE(chunk.byteLength, 0);
          socket.write(length);
          socket.write(chunk);
        }
        socket.end(Buffer.alloc(4));
      });
    });
  }
}
