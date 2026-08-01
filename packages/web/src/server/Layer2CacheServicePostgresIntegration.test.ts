import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { vi } from 'vitest';

vi.mock('../app/actions/auth/AuthResolver', () => ({
  AuthResolver: {
    resolveActorUserId: vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000989'),
  },
}));
import pg from 'pg';
import { PgExecutor } from '@dashboard/core';
import { GlobalViewStore, flattenViewPages } from '../app/cache/ViewStore';
import { FetchCoordinator, ViewIntent } from '../app/cache/CacheService';
import { GlobalPolicyRegistry } from '../app/cache/PolicyRegistry';

describe('Layer 2 Cache Service - Real PostgreSQL Integration Test', () => {
  let pool: pg.Pool;
  let executor: PgExecutor;

  const testNodeId = '00000000-0000-0000-0000-000000000980';
  const testNodeTypeId = '00000000-0000-0000-0000-000000000981';
  const testEntityTypeId = '00000000-0000-0000-0000-000000000982';
  const testActorUserId = '00000000-0000-0000-0000-000000000989';
  
  const viewKey = `SUBTREE_LIST|baseNodeId:${testNodeId}`;

  beforeAll(async () => {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:masterpass@localhost:5433/dashboard',
    });
    executor = new PgExecutor(pool);

    await executor.query('DELETE FROM users WHERE id = $1', [testActorUserId]);
    await executor.query('DELETE FROM entities WHERE parent_node_id = $1', [testNodeId]);
    await executor.query('DELETE FROM nodes WHERE id = $1', [testNodeId]);
    await executor.query('DELETE FROM node_types WHERE id = $1 OR type_key = $2', [testNodeTypeId, 'layer2-folder']);
    await executor.query('DELETE FROM entity_types WHERE id = $1 OR type_key = $2 OR storage_table = $3', [testEntityTypeId, 'layer2-device', 'entity_device_l2']);
    await executor.query(
      `INSERT INTO users (id, email, password_hash, is_active, is_super_admin)
       VALUES ($1, 'layer2-integration@dashboard.test', 'not-used', true, true)`,
      [testActorUserId]
    );

    await executor.query(`
      INSERT INTO node_types (id, type_key, name, description)
      VALUES ($1, 'layer2-folder', 'Layer 2 Folder', 'Folder')
    `, [testNodeTypeId]);

    await executor.query(`
      INSERT INTO entity_types (id, type_key, name, description, storage_table)
      VALUES ($1, 'layer2-device', 'Layer 2 Device', 'Device', 'entity_device_l2')
    `, [testEntityTypeId]);

    await executor.query(`
      INSERT INTO nodes (id, parent_id, path, path_label, depth, node_type_id, name, description)
      VALUES ($1, NULL, 'layer2_root'::ltree, 'layer2_root', 0, $2, 'Layer 2 Root Node', 'Root')
    `, [testNodeId, testNodeTypeId]);

    // Popola 150 entità reali per testare il trimming del Layer 2 (maxWindowChunks = 8, 8 * 15 = 120 elementi)
    for (let i = 1; i <= 150; i++) {
      const paddedNum = String(i).padStart(3, '0');
      await executor.query(`
        INSERT INTO entities (id, entity_type_id, parent_node_id, name, description, row_version, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, 'Layer 2 test entity', 1, NOW(), NOW())
      `, [testEntityTypeId, testNodeId, `Layer2 Entity ${paddedNum}`]);
    }
  });

  afterAll(async () => {
    try {
      await executor.query('DELETE FROM entities WHERE parent_node_id = $1', [testNodeId]);
      await executor.query('DELETE FROM nodes WHERE id = $1', [testNodeId]);
      await executor.query('DELETE FROM node_types WHERE id = $1 OR type_key = $2', [testNodeTypeId, 'layer2-folder']);
      await executor.query('DELETE FROM entity_types WHERE id = $1 OR type_key = $2 OR storage_table = $3', [testEntityTypeId, 'layer2-device', 'entity_device_l2']);
      await executor.query('DELETE FROM users WHERE id = $1', [testActorUserId]);
    } catch {}
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(() => {
    GlobalViewStore.delete(viewKey);
    GlobalPolicyRegistry.releaseAll('test-owner');
  });

  it('Layer 2 Integration Test: applica il trimming a chunk (eviction a 8 pagine max) sui dati reali estratti da PostgreSQL', async () => {
    const params = { viewType: 'SUBTREE_LIST' as const, baseNodeId: testNodeId };
    
    // 1. Initial resolve (Page 1)
    let intent: ViewIntent = { type: 'resolve', params, requireComplete: false };
    await FetchCoordinator.executeFetch(intent, viewKey);
    
    // 2. Extend forward per 9 volte per un totale di 10 pagine (150 item).
    // Siccome il limite è 8 chunk nell'IngestionLayer, dovremmo conservare le ultime 8 pagine (120 item).
    for (let page = 2; page <= 10; page++) {
      intent = { type: 'extend', params, requireComplete: false, direction: 'forward', pageSize: 15 };
      await FetchCoordinator.executeFetch(intent, viewKey);
    }

    const view = GlobalViewStore.get(viewKey);
    expect(view).not.toBeNull();
    
    // Le pagine dovrebbero essere tagliate a 8
    expect(view!.pages.length).toBe(8);
    expect(flattenViewPages(view!).length).toBeGreaterThan(100); // circa 8 * 15, al netto di dedupliche
  });

  it('Layer 2 Integration Test: risale all indietro dal fondo eseguendo l eviction in coda ed il recupero in cima', async () => {
    const params = { viewType: 'SUBTREE_LIST' as const, baseNodeId: testNodeId };
    
    // 1. Scendiamo fino in fondo (10 pagine in totale, le prime 2 vengono evictate, rimangono le ultime 8)
    await FetchCoordinator.executeFetch({ type: 'resolve', params, requireComplete: false }, viewKey);
    for (let page = 2; page <= 10; page++) {
      await FetchCoordinator.executeFetch({ type: 'extend', params, requireComplete: false, direction: 'forward', pageSize: 15 }, viewKey);
    }

    // 2. Ora scrolliamo all'indietro (Prepend / Backward) 2 volte per recuperare le 2 pagine in cima
    for (let bPage = 1; bPage <= 2; bPage++) {
      await FetchCoordinator.executeFetch({ type: 'extend', params, requireComplete: false, direction: 'backward', pageSize: 15 }, viewKey);
    }

    const view = GlobalViewStore.get(viewKey);
    expect(view).not.toBeNull();
    
    // La lunghezza torna a 8 pagine (dopo l'append dietro, sono state poppate le pagine in fondo)
    expect(view!.pages.length).toBe(8);
    
    const flatItems = flattenViewPages(view!);
    expect(flatItems.length).toBeGreaterThan(90); // circa 120, ma con possibili dedupliche ai confini


    // Siamo tornati in cima
    expect(view!.pages[0].hasMoreBackward).toBe(false);
    expect(view!.pages[7].hasMoreForward).toBe(true);
  });
});
