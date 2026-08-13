import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditPortPostgres } from './AuditPortPostgres.js';
import { RevisionPortPostgres } from './RevisionPortPostgres.js';

import { RuntimeConfigurationPortPostgres } from './RuntimeConfigurationPortPostgres.js';
import { AccessControlPortPostgres } from './AccessControlPortPostgres.js';
import { ForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import type { PgExecutor } from './PgExecutor.js';
import { Node } from '../../domain/models/Node.js';
import { Entity } from '../../domain/models/Entity.js';

describe('Governance and Security PostgreSQL Adapters', () => {
  let mockExecutor: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockExecutor = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
  });

  // ─── AuditPortPostgres ──────────────────────────────────────────

  describe('AuditPortPostgres', () => {
    it('should correctly format and insert audit logs', async () => {
      const adapter = new AuditPortPostgres(mockExecutor as unknown as PgExecutor);
      await adapter.record(
        'user-1',
        'node.create',
        'node',
        'node-id-1',
        'parent-id-1',
        { status: 'old' },
        { status: 'new' }
      );

      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [
          'user-1',
          'node.create',
          'node',
          'node-id-1',
          'parent-id-1',
          JSON.stringify({ status: 'old' }),
          JSON.stringify({ status: 'new' }),
        ]
      );
    });

    it('should handle null payloads', async () => {
      const adapter = new AuditPortPostgres(mockExecutor as unknown as PgExecutor);
      await adapter.record('user-1', 'node.delete', 'node', 'node-id-1', null, null, null);

      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        ['user-1', 'node.delete', 'node', 'node-id-1', null, null, null]
      );
    });
  });

  // ─── RevisionPortPostgres ───────────────────────────────────────

  describe('RevisionPortPostgres', () => {
    it('should insert a node revision snapshot', async () => {
      const adapter = new RevisionPortPostgres(mockExecutor as unknown as PgExecutor);
      const node = new Node(
        'node-1',
        'parent-1',
        'parent-1.my_node',
        'my_node',
        1,
        'type-1',
        'My Node',
        'Description',
        3, // rowVersion
        new Date(),
        new Date(),
        null,
        null,
        null
      );

      await adapter.recordNodeRevision(node, 'updated', 'user-1');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO node_revisions'),
        [
          'node-1',
          3, // revision_number
          'updated',
          3, // node_row_version
          1, // schema_version
          expect.stringContaining('"name":"My Node"'),
          'user-1',
        ]
      );
    });

    it('should insert an entity revision snapshot', async () => {
      const adapter = new RevisionPortPostgres(mockExecutor as unknown as PgExecutor);
      const entity = new Entity(
        'entity-1',
        'type-1',
        'parent-1',
        'My Entity',
        'Desc',
        4, // rowVersion
        new Date(),
        new Date(),
        null,
        null,
        null,
        { color: 'red' }
      );

      await adapter.recordEntityRevision(entity, 'created', 'user-1');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entity_revisions'),
        [
          'entity-1',
          4, // revision_number
          'created',
          4, // entity_row_version
          'type-1', // entityTypeId passes in query as parameter 5 for current_schema_version select
          expect.stringContaining('"color":"red"'),
          'user-1',
        ]
      );
    });
  });



  // ─── RuntimeConfigurationPortPostgres ───────────────────────────

  describe('RuntimeConfigurationPortPostgres', () => {
    it('should return true if capability is enabled', async () => {
      const adapter = new RuntimeConfigurationPortPostgres(mockExecutor as unknown as PgExecutor);
      mockExecutor.query.mockResolvedValueOnce({
        rows: [{ status: 'enabled' }],
      });

      const enabled = await adapter.isCapabilityEnabled('locking');
      expect(enabled).toBe(true);
    });

    it('should return false if capability is disabled', async () => {
      const adapter = new RuntimeConfigurationPortPostgres(mockExecutor as unknown as PgExecutor);
      mockExecutor.query.mockResolvedValueOnce({
        rows: [{ status: 'disabled' }],
      });

      const enabled = await adapter.isCapabilityEnabled('locking');
      expect(enabled).toBe(false);
    });

    it('should support string, integer, boolean, and json setting types', async () => {
      const adapter = new RuntimeConfigurationPortPostgres(mockExecutor as unknown as PgExecutor);

      // String
      mockExecutor.query.mockResolvedValueOnce({
        rows: [{ value_type: 'string', value_text: 'hello', value_json: null }],
      });
      expect(await adapter.getSetting('k1', 'def')).toBe('hello');

      // Integer
      mockExecutor.query.mockResolvedValueOnce({
        rows: [{ value_type: 'integer', value_text: '42', value_json: null }],
      });
      expect(await adapter.getSetting('k2', 0)).toBe(42);

      // Boolean
      mockExecutor.query.mockResolvedValueOnce({
        rows: [{ value_type: 'boolean', value_text: 'true', value_json: null }],
      });
      expect(await adapter.getSetting('k3', false)).toBe(true);

      // JSON (pg returns parsed object)
      mockExecutor.query.mockResolvedValueOnce({
        rows: [{ value_type: 'json', value_text: null, value_json: { custom: 'data' } }],
      });
      expect(await adapter.getSetting('k4', {})).toEqual({ custom: 'data' });
    });

    it('should return defaultValue if setting not found', async () => {
      const adapter = new RuntimeConfigurationPortPostgres(mockExecutor as unknown as PgExecutor);
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });

      expect(await adapter.getSetting('nonexistent', 'fallback')).toBe('fallback');
    });
  });

  // ─── AccessControlPortPostgres ──────────────────────────────────

  describe('AccessControlPortPostgres', () => {
    it('uses the materialized assignment path in generated read ACL SQL', () => {
      const sql = AccessControlPortPostgres.getReadAccessControlSql('$1', 'n', 'node.read');

      expect(sql).toContain('nsa.node_path @> n.path');
      expect(sql).not.toContain('SELECT path FROM nodes WHERE id = nsa.node_id');
    });

    it('should allow access if user has global permission', async () => {
      const adapter = new AccessControlPortPostgres(mockExecutor as unknown as PgExecutor);
      // active super-admin check: regular user
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });
      // ur query: has permission
      mockExecutor.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      await expect(adapter.assertHasPermission('user-1', 'system.config', null)).resolves.not.toThrow();
    });

    it('treats an active super-admin as an absolute bypass before local denies', async () => {
      const adapter = new AccessControlPortPostgres(mockExecutor as unknown as PgExecutor);
      mockExecutor.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      await expect(adapter.assertCanCreateNode('super-1', 'parent-1', 'device')).resolves.not.toThrow();
      expect(mockExecutor.query).toHaveBeenCalledTimes(1);
    });

    it('should deny access if user has explicit local deny', async () => {
      const adapter = new AccessControlPortPostgres(mockExecutor as unknown as PgExecutor);
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });
      // nsa query: has deny
      mockExecutor.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      await expect(adapter.assertCanCreateNode('user-1', 'parent-1', 'device')).rejects.toThrow(
        ForbiddenError
      );
      // the global check shouldn't even run
      expect(mockExecutor.query).toHaveBeenCalledTimes(2);
    });

    it('uses the scope assignment node id for self-scope permission checks', async () => {
      const adapter = new AccessControlPortPostgres(mockExecutor as unknown as PgExecutor);
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });
      mockExecutor.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      await expect(adapter.assertCanCreateNode('user-1', 'parent-1', 'device')).rejects.toThrow(ForbiddenError);
      expect(mockExecutor.query.mock.calls[1]?.[0]).toContain('nsa.node_id = $3');
      expect(mockExecutor.query.mock.calls[1]?.[0]).not.toContain('n.id = $3');
    });

    it('should deny access if user has neither global nor local allow (default deny)', async () => {
      const adapter = new AccessControlPortPostgres(mockExecutor as unknown as PgExecutor);
      // active super-admin check: regular user
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });
      // nsa query: no deny
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });
      // ur query: no global allow
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });
      // nsa allow query: no local allow
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });

      await expect(adapter.assertCanCreateNode('user-1', 'parent-1', 'device')).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should resolve parent node and verify permission in assertCanEditEntity', async () => {
      const adapter = new AccessControlPortPostgres(mockExecutor as unknown as PgExecutor);
      
      // 1. SELECT parent_node_id
      mockExecutor.query.mockResolvedValueOnce({
        rows: [{ parent_node_id: 'parent-1' }],
      });
      // 2. nsa deny check
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });
      // 3. active super-admin check
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });
      // 4. global allow check
      mockExecutor.query.mockResolvedValueOnce({ rows: [] });
      // 5. local allow check
      mockExecutor.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      await expect(adapter.assertCanEditEntity('user-1', 'entity-1')).resolves.not.toThrow();

      expect(mockExecutor.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT parent_node_id FROM entities'),
        ['entity-1']
      );
    });
  });
});
