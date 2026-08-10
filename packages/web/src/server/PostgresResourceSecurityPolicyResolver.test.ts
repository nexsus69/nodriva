import { describe, expect, it, vi } from 'vitest';
import { PostgresResourceSecurityPolicyResolver } from './PostgresResourceSecurityPolicyResolver';

describe('PostgresResourceSecurityPolicyResolver', () => {
  it('resolves global policy for a node when the type inherits', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ encryption_mode: 'inherit' }] }) };
    const config = { get: vi.fn().mockResolvedValue(true) };
    const nodes = { findById: vi.fn().mockResolvedValue({ nodeTypeId: 'type-1' }) };
    const entities = { findById: vi.fn() };
    const resolver = new PostgresResourceSecurityPolicyResolver(executor as never, config as never, nodes as never, entities as never);
    await expect(resolver.resolve('node', 'node-1')).resolves.toEqual({ encryptionEnabled: true, antivirusEnabled: true });
  });

  it('uses the parent node type and explicit disabled encryption for entities', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ encryption_mode: 'disabled' }] }) };
    const config = { get: vi.fn().mockResolvedValue(true) };
    const nodes = { findById: vi.fn().mockResolvedValue({ nodeTypeId: 'type-2' }) };
    const entities = { findById: vi.fn().mockResolvedValue({ parentNodeId: 'node-2' }) };
    const resolver = new PostgresResourceSecurityPolicyResolver(executor as never, config as never, nodes as never, entities as never);
    await expect(resolver.resolve('entity', 'entity-1')).resolves.toEqual({ encryptionEnabled: false, antivirusEnabled: true });
    expect(nodes.findById).toHaveBeenCalledWith('node-2');
  });
});
