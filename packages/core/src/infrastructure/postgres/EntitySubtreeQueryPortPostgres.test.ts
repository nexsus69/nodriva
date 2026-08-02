import { describe, it, expect, vi } from 'vitest';
import { EntitySubtreeQueryPortPostgres } from './EntitySubtreeQueryPortPostgres.js';
import { PgExecutor } from './PgExecutor.js';

describe('EntitySubtreeQueryPortPostgres', () => {
  const validUUID = '00000000-0000-0000-0000-000000000001';

  it('returns empty list if base node does not exist or is invalid UUID', async () => {
    const mockExecutor = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    };

    const port = new EntitySubtreeQueryPortPostgres(mockExecutor as unknown as PgExecutor);
    const resInvalid = await port.findSubtreeEntitiesPaginated({ baseNodeId: 'invalid-uuid-string', limit: 10, actorUserId: '00000000-0000-0000-0000-000000000001' });
    expect(resInvalid.items).toEqual([]);
    expect(resInvalid.hasMore).toBe(false);

    const res = await port.findSubtreeEntitiesPaginated({ baseNodeId: validUUID, limit: 10, actorUserId: '00000000-0000-0000-0000-000000000001' });
    expect(res.items).toEqual([]);
    expect(res.hasMore).toBe(false);
  });

  it('queries subtree entities using ltree path and supports forward cursor pagination', async () => {
    const mockExecutor = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ path: 'root.company' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              entity_id: '00000000-0000-0000-0000-000000000010',
              parent_node_id: validUUID,
              entity_type_id: '00000000-0000-0000-0000-000000000099',
              entity_name: 'Device 1',
              entity_description: 'Test device',
              entity_row_version: 1,
              entity_created_at: new Date('2026-01-01'),
              entity_updated_at: new Date('2026-01-01'),
              node_name: 'Company Node',
              node_path: 'root.company',
              node_depth: 1,
              node_row_version: 4,
            },
            {
              entity_id: '00000000-0000-0000-0000-000000000011',
              parent_node_id: validUUID,
              entity_type_id: '00000000-0000-0000-0000-000000000099',
              entity_name: 'Device 2',
              entity_description: 'Second test device',
              entity_row_version: 1,
              entity_created_at: new Date('2026-01-02'),
              entity_updated_at: new Date('2026-01-02'),
              node_name: 'Branch Node',
              node_path: 'root.company.branch',
              node_depth: 2,
              node_row_version: 7,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ entity_type_id: '00000000-0000-0000-0000-000000000099', storage_table: 'entity_device' }] })
        .mockResolvedValueOnce({ rows: [{ entity_type_id: '00000000-0000-0000-0000-000000000099', field_key: 'serialNumber', column_name: 'serial_number' }] })
        .mockResolvedValueOnce({ rows: [
          { entity_id: '00000000-0000-0000-0000-000000000010', serial_number: 'SN-001' },
          { entity_id: '00000000-0000-0000-0000-000000000011', serial_number: 'SN-002' },
        ] }),
    };

    const port = new EntitySubtreeQueryPortPostgres(mockExecutor as unknown as PgExecutor);
    const res = await port.findSubtreeEntitiesPaginated({
      baseNodeId: validUUID,
      limit: 10,
      search: 'device',
      actorUserId: '00000000-0000-0000-0000-000000000001',
    });

    expect(res.items.length).toBe(2);
    expect(res.items[0]?.id).toBe('00000000-0000-0000-0000-000000000010');
    expect(res.items[0]?.name).toBe('Device 1');
    expect(res.items[0]?.nodeRowVersion).toBe(4);
    expect(res.items[0]?.payload).toEqual({ serialNumber: 'SN-001' });
    expect(res.items[1]?.id).toBe('00000000-0000-0000-0000-000000000011');
    expect(res.items[1]?.name).toBe('Device 2');
    expect(res.items[1]?.nodeRowVersion).toBe(7);
    expect(res.nextCursor).toEqual({ path: 'root.company.branch', name: 'Device 2', id: '00000000-0000-0000-0000-000000000011' });
  });

  it('supports backward pagination and reverses returned items to natural ascending order', async () => {
    const mockExecutor = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ path: 'root.company' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              entity_id: '00000000-0000-0000-0000-000000000011',
              parent_node_id: validUUID,
              entity_type_id: '00000000-0000-0000-0000-000000000099',
              entity_name: 'Device 2',
              entity_description: 'Second test device',
              entity_row_version: 1,
              entity_created_at: new Date('2026-01-02'),
              entity_updated_at: new Date('2026-01-02'),
              node_name: 'Branch Node',
              node_path: 'root.company.branch',
              node_depth: 2,
            },
            {
              entity_id: '00000000-0000-0000-0000-000000000010',
              parent_node_id: validUUID,
              entity_type_id: '00000000-0000-0000-0000-000000000099',
              entity_name: 'Device 1',
              entity_description: 'Test device',
              entity_row_version: 1,
              entity_created_at: new Date('2026-01-01'),
              entity_updated_at: new Date('2026-01-01'),
              node_name: 'Company Node',
              node_path: 'root.company',
              node_depth: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ entity_type_id: '00000000-0000-0000-0000-000000000099', storage_table: 'entity_device' }] })
        .mockResolvedValueOnce({ rows: [{ entity_type_id: '00000000-0000-0000-0000-000000000099', field_key: 'serialNumber', column_name: 'serial_number' }] })
        .mockResolvedValueOnce({ rows: [
          { entity_id: '00000000-0000-0000-0000-000000000011', serial_number: 'SN-002' },
          { entity_id: '00000000-0000-0000-0000-000000000010', serial_number: 'SN-001' },
        ] }),
    };

    const port = new EntitySubtreeQueryPortPostgres(mockExecutor as unknown as PgExecutor);
    const res = await port.findSubtreeEntitiesPaginated({
      baseNodeId: validUUID,
      limit: 10,
      direction: 'backward',
      cursor: { path: 'root.company.branch', name: 'Device 2', id: '00000000-0000-0000-0000-000000000011' },
      actorUserId: '00000000-0000-0000-0000-000000000001',
    });

    expect(res.items[0]?.id).toBe('00000000-0000-0000-0000-000000000010');
    expect(res.items[1]?.id).toBe('00000000-0000-0000-0000-000000000011');
  });
});
