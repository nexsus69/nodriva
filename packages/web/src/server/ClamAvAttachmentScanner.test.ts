import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { ClamAvAttachmentScanner } from './ClamAvAttachmentScanner';

describe('ClamAvAttachmentScanner', () => {
  const servers: net.Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
      server.close(() => resolve());
    })));
  });

  async function listen(handler: (socket: net.Socket) => void): Promise<number> {
    const server = net.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    return (server.address() as net.AddressInfo).port;
  }

  it('resolves from clamd response without waiting for TCP close', async () => {
    const port = await listen((socket) => {
      socket.on('data', (data) => {
        if (data.includes(Buffer.from([0, 0, 0, 0]))) socket.write(`stream: OK${String.fromCharCode(0)}`);
      });
    });

    await expect(new ClamAvAttachmentScanner('127.0.0.1', port, 500).scan(new Uint8Array([1, 2, 3])))
      .resolves.toBe('clean');
  });

  it('returns infected when clamd reports FOUND', async () => {
    const port = await listen((socket) => {
      socket.on('data', (data) => {
        if (data.includes(Buffer.from([0, 0, 0, 0]))) socket.write(`stream: Eicar-Test-Signature FOUND${String.fromCharCode(0)}`);
      });
    });

    await expect(new ClamAvAttachmentScanner('127.0.0.1', port, 500).scan(new Uint8Array([1])))
      .resolves.toBe('infected');
  });
});
