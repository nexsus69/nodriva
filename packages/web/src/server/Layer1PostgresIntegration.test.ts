import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';

vi.mock('../app/actions/auth/AuthResolver', () => ({
  AuthResolver: {
    resolveActorUserId: vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000979'),
  },
}));
import pg from 'pg';
import { PgExecutor } from '@dashboard/core';
import { listSubtreeEntitiesAction } from '../app/actions/entityActions.js';

describe('Layer 1 (Server Action listSubtreeEntitiesAction) - PostgreSQL 150 Entities with Incomplete Page (limit 20)', () => {
  let pool: pg.Pool;
  let executor: PgExecutor;

  const testNodeId = '00000000-0000-0000-0000-000000000970';
  const testChildNodeId = '00000000-0000-0000-0000-000000000971';
  const testNodeTypeId = '00000000-0000-0000-0000-000000000972';
  const testEntityTypeId = '00000000-0000-0000-0000-000000000973';
  const testActorUserId = '00000000-0000-0000-0000-000000000979';

  beforeAll(async () => {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:masterpass@localhost:5433/dashboard',
    });
    executor = new PgExecutor(pool);

    // Ripulisci dati precedenti
    await executor.query('DELETE FROM users WHERE id = $1', [testActorUserId]);
    await executor.query('DELETE FROM entities WHERE parent_node_id IN ($1, $2)', [testNodeId, testChildNodeId]);
    await executor.query('DELETE FROM nodes WHERE id IN ($1, $2)', [testNodeId, testChildNodeId]);
    await executor.query('DELETE FROM node_types WHERE id = $1 OR type_key = $2', [testNodeTypeId, 'layer1-limit20-folder']);
    await executor.query('DELETE FROM entity_types WHERE id = $1 OR type_key = $2 OR storage_table = $3', [testEntityTypeId, 'layer1-limit20-device', 'entity_device_l1']);
    await executor.query(
      `INSERT INTO users (id, email, password_hash, is_active, is_super_admin)
       VALUES ($1, 'layer1-integration@dashboard.test', 'not-used', true, true)`,
      [testActorUserId]
    );

    // Crea Node Type e Entity Type
    await executor.query(`
      INSERT INTO node_types (id, type_key, name, description)
      VALUES ($1, 'layer1-limit20-folder', 'Layer 1 Limit 20 Folder', 'Folder')
    `, [testNodeTypeId]);

    await executor.query(`
      INSERT INTO entity_types (id, type_key, name, description, storage_table)
      VALUES ($1, 'layer1-limit20-device', 'Layer 1 Limit 20 Device', 'Device Description', 'entity_device_l1')
    `, [testEntityTypeId]);

    // Crea Nodi Gerarchici con ltree
    await executor.query(`
      INSERT INTO nodes (id, parent_id, path, path_label, depth, node_type_id, name, description)
      VALUES ($1, NULL, 'layer1_l20'::ltree, 'layer1_l20', 0, $2, 'Layer 1 Limit20 Root Node', 'Limit20 Root')
    `, [testNodeId, testNodeTypeId]);

    await executor.query(`
      INSERT INTO nodes (id, parent_id, path, path_label, depth, node_type_id, name, description)
      VALUES ($1, $2, 'layer1_l20.sub'::ltree, 'sub', 1, $3, 'Layer 1 Limit20 Sub Node', 'Limit20 Sub')
    `, [testChildNodeId, testNodeId, testNodeTypeId]);

    // Popola 100 entità nel nodo root e 50 nel nodo figlio (TOTALE 150 ENTITÀ)
    for (let i = 1; i <= 100; i++) {
      const paddedNum = String(i).padStart(3, '0');
      await executor.query(`
        INSERT INTO entities (id, entity_type_id, parent_node_id, name, description, row_version, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, 'Limit20 root entity test', 1, NOW(), NOW())
      `, [testEntityTypeId, testNodeId, `Entity Root L20 ${paddedNum}`]);
    }

    for (let i = 1; i <= 50; i++) {
      const paddedNum = String(i).padStart(3, '0');
      await executor.query(`
        INSERT INTO entities (id, entity_type_id, parent_node_id, name, description, row_version, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, 'Limit20 sub entity test', 1, NOW(), NOW())
      `, [testEntityTypeId, testChildNodeId, `Entity Sub L20 ${paddedNum}`]);
    }
  });

  afterAll(async () => {
    try {
      await executor.query('DELETE FROM entities WHERE parent_node_id IN ($1, $2)', [testNodeId, testChildNodeId]);
      await executor.query('DELETE FROM nodes WHERE id IN ($1, $2)', [testNodeId, testChildNodeId]);
      await executor.query('DELETE FROM node_types WHERE id = $1 OR type_key = $2', [testNodeTypeId, 'layer1-limit20-folder']);
      await executor.query('DELETE FROM entity_types WHERE id = $1 OR type_key = $2 OR storage_table = $3', [testEntityTypeId, 'layer1-limit20-device', 'entity_device_l1']);
      await executor.query('DELETE FROM users WHERE id = $1', [testActorUserId]);
    } catch {}
    if (pool) {
      await pool.end();
    }
  });

  it('Layer 1 Limit 20 Test: scorre FORWARD 150 entità con limit 20 (7 pagine da 20 + 1 pagina incompleta da 10)', async () => {
    const fetchedIds = new Set<string>();
    let currentCursor: { path: string; name: string; id: string } | undefined = undefined;
    const pageSizes: number[] = [];

    do {
      const res = await listSubtreeEntitiesAction({
        baseNodeId: testNodeId,
        limit: 20,
        direction: 'forward',
        cursor: currentCursor,
      });

      expect(res.items.length).toBeGreaterThan(0);
      pageSizes.push(res.items.length);

      for (const item of res.items) {
        expect(fetchedIds.has(item.id)).toBe(false);
        fetchedIds.add(item.id);
      }

      currentCursor = res.nextCursor;
      if (!res.hasMore) break;
    } while (currentCursor);

    expect(fetchedIds.size).toBe(150);
    expect(pageSizes).toEqual([20, 20, 20, 20, 20, 20, 20, 10]);
  });

  it('Layer 1 Limit 20 Test: scorre BACKWARD 150 entità partendo dall ultima pagina incompleta (10 entità) fino alla cima', async () => {
    const forwardPages: any[] = [];
    let fCursor: { path: string; name: string; id: string } | undefined = undefined;

    do {
      const res = await listSubtreeEntitiesAction({
        baseNodeId: testNodeId,
        limit: 20,
        direction: 'forward',
        cursor: fCursor,
      });
      forwardPages.push(res);
      fCursor = res.nextCursor;
      if (!res.hasMore) break;
    } while (fCursor);

    expect(forwardPages.length).toBe(8);
    expect(forwardPages[7].items.length).toBe(10);

    const backwardPages: any[] = [];
    let currentPrevCursor: { path: string; name: string; id: string } | undefined = forwardPages[7].prevCursor;

    while (currentPrevCursor) {
      const res = await listSubtreeEntitiesAction({
        baseNodeId: testNodeId,
        limit: 20,
        direction: 'backward',
        cursor: currentPrevCursor,
      });

      if (res.items.length === 0) break;
      backwardPages.unshift(res);

      currentPrevCursor = res.prevCursor;
      if (!res.hasMore) break;
    }

    expect(backwardPages.length).toBe(7);
    const backwardTotalIds = new Set(backwardPages.flatMap((p) => p.items.map((i: any) => i.id)));
    expect(backwardTotalIds.size).toBe(140);
    expect(backwardPages[0].items.map((i: any) => i.id)).toEqual(forwardPages[0].items.map((i: any) => i.id));
  });
});
