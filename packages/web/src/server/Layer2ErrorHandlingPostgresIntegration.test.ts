import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../app/actions/auth/AuthResolver', () => ({
  AuthResolver: {
    resolveActorUserId: vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000999'),
  },
}));
import pg from 'pg';
import { PgExecutor } from '@dashboard/core';
import { listSubtreeEntitiesAction } from '../app/actions/entityActions.js';

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
const integrationDatabaseName = integrationDatabaseUrl
  ? new URL(integrationDatabaseUrl).pathname.slice(1)
  : '';
const isIsolatedTestDatabase = Boolean(
  integrationDatabaseUrl
  && process.env.DATABASE_URL === integrationDatabaseUrl
  && /(?:^|_)test(?:_|$)/.test(integrationDatabaseName),
);

(isIsolatedTestDatabase ? describe : describe.skip)('Layer 2 Error Handling & Fault Tolerance - PostgreSQL Real DB Integration Test', () => {
  let pool: pg.Pool;
  let executor: PgExecutor;

  const testNodeId = '00000000-0000-0000-0000-000000000990';
  const testActorUserId = '00000000-0000-0000-0000-000000000999';

  beforeAll(async () => {
    pool = new pg.Pool({
      connectionString: integrationDatabaseUrl,
    });
    executor = new PgExecutor(pool);
    await executor.query('DELETE FROM users WHERE id = $1', [testActorUserId]);
    await executor.query(
      `INSERT INTO users (id, email, password_hash, is_active, is_super_admin)
       VALUES ($1, 'layer2-errors@dashboard.test', 'not-used', true, true)`,
      [testActorUserId]
    );
  });

  afterAll(async () => {
    await executor.query('DELETE FROM users WHERE id = $1', [testActorUserId]);
    if (pool) {
      await pool.end();
    }
  });

  it('Layer 2 Error Handling Test: la chiamata su nodo inesistente o senza entità restituisce un array vuoto [] senza mandare in crash il sistema', async () => {
    const res = await listSubtreeEntitiesAction({
      baseNodeId: testNodeId,
      limit: 15,
      direction: 'forward',
    });

    expect(res.items).toEqual([]);
    expect(res.hasMore).toBe(false);
    expect(res.nextCursor).toBeUndefined();
    expect(res.prevCursor).toBeUndefined();
  });

  it('Layer 2 Error Handling Test: gestisce la cancellazione o la modifica concorrente di una riga durante la paginazione', async () => {
    // Cursore fittizio o con ID inesistente
    const deletedCursor = {
      path: 'non_existent.path',
      name: 'Non Existent Name',
      id: '00000000-0000-0000-0000-000000000000',
    };

    // PostgreSQL gestisce la tupla ROW(...) > ROW(...) trovando i record successivi anche se il cursore esatto non esiste più
    const res = await listSubtreeEntitiesAction({
      baseNodeId: testNodeId,
      limit: 15,
      direction: 'forward',
      cursor: deletedCursor,
    });

    expect(res.items).toBeDefined();
    expect(Array.isArray(res.items)).toBe(true);
  });
});
