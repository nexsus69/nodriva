import { describe, expect, it, vi } from 'vitest';
import { FieldEncryptionService } from './FieldEncryptionService.js';

describe('FieldEncryptionService', () => {
  it('stores encrypted fields outside the plaintext payload and restores them', async () => {
    const rows: Array<{ field_key: string; ciphertext: string }> = [];
    const executor = {
      query: vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
        if (sql.startsWith('SELECT field_key, ciphertext')) return { rows };
        if (sql.startsWith('SELECT field_key')) return { rows: [{ field_key: 'secret', encryption_mode: 'encrypted' }] };
        if (sql.startsWith('INSERT INTO resource_field_ciphertexts')) {
          rows.splice(0, rows.length, { field_key: String(params[2]), ciphertext: String(params[4]) });
        }
        return { rows: [] };
      }),
    };
    const config = { get: vi.fn().mockResolvedValue(true) };
    const service = new FieldEncryptionService(executor as never, config as never, '22'.repeat(32));
    const protectedPayload = await service.protect('entity', 'type-1', 'entity-1', { secret: 'value', label: 'visible' });
    expect(protectedPayload).toEqual({ secret: null, label: 'visible' });
    expect(rows[0]?.ciphertext).not.toContain('value');
    await expect(service.restore('entity', 'entity-1', protectedPayload)).resolves.toEqual({ secret: 'value', label: 'visible' });
  });

  it('does not encrypt when the global encryption switch is disabled', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ field_key: 'secret', encryption_mode: 'encrypted' }] }) };
    const service = new FieldEncryptionService(executor as never, { get: vi.fn().mockResolvedValue(false) } as never, undefined);
    await expect(service.protect('node', 'type-1', 'node-1', { secret: 'value' })).resolves.toEqual({ secret: 'value' });
  });

  it('removes the sidecar when an encrypted field is cleared', async () => {
    const executor = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ field_key: 'secret', encryption_mode: 'encrypted' }] })
      .mockResolvedValue({ rows: [] }) };
    const service = new FieldEncryptionService(executor as never, { get: vi.fn().mockResolvedValue(true) } as never, '22'.repeat(32));

    await expect(service.protect('entity', 'type-1', 'entity-1', { secret: null })).resolves.toEqual({ secret: null });
    expect(executor.query).toHaveBeenCalledWith(
      'DELETE FROM resource_field_ciphertexts WHERE resource_type = $1 AND resource_id = $2 AND field_key = $3',
      ['entity', 'entity-1', 'secret'],
    );
  });

  it('removes a sidecar when an encrypted field is omitted from a complete update payload', async () => {
    const executor = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ field_key: 'secret', encryption_mode: 'encrypted' }] })
      .mockResolvedValue({ rows: [] }) };
    const service = new FieldEncryptionService(executor as never, { get: vi.fn().mockResolvedValue(true) } as never, '22'.repeat(32));

    await expect(service.protect('entity', 'type-1', 'entity-1', { label: 'visible' })).resolves.toEqual({ label: 'visible' });
    expect(executor.query).toHaveBeenCalledWith(
      'DELETE FROM resource_field_ciphertexts WHERE resource_type = $1 AND resource_id = $2 AND field_key = $3',
      ['entity', 'entity-1', 'secret'],
    );
  });

  it('fails closed when encryption is enabled but the key is missing', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ field_key: 'secret', encryption_mode: 'encrypted' }] }) };
    const service = new FieldEncryptionService(executor as never, { get: vi.fn().mockResolvedValue(true) } as never, undefined);
    await expect(service.protect('node', 'type-1', 'node-1', { secret: 'value' })).rejects.toThrow('FIELD_ENCRYPTION_KEY');
  });
});
