import { describe, expect, it, vi } from 'vitest';
import { PostgresResourceSecurityPolicyResolver } from './PostgresResourceSecurityPolicyResolver';

describe('PostgresResourceSecurityPolicyResolver', () => {
  it('keeps attachments in plaintext when the type policy is disabled', async () => {
    const policy = { getEncryptionMode: vi.fn().mockResolvedValue('disabled') };
    const config = { get: vi.fn().mockResolvedValue(true) };
    const nodes = { findById: vi.fn().mockResolvedValue({ nodeTypeId: 'type-1' }) };
    const entities = { findById: vi.fn() };
    const resolver = new PostgresResourceSecurityPolicyResolver(policy as never, config as never, nodes as never, entities as never);
    await expect(resolver.resolve('node', 'node-1')).resolves.toEqual({ encryptionEnabled: false, antivirusEnabled: true });
  });

  it('does not encrypt attachments when the global switch is disabled even for an enabled type', async () => {
    const policy = { getEncryptionMode: vi.fn().mockResolvedValue('enabled') };
    const config = { get: vi.fn().mockResolvedValue(false) };
    const nodes = { findById: vi.fn().mockResolvedValue({ nodeTypeId: 'type-1' }) };
    const resolver = new PostgresResourceSecurityPolicyResolver(policy as never, config as never, nodes as never, {} as never);
    await expect(resolver.resolve('node', 'node-1')).resolves.toEqual({ encryptionEnabled: false, antivirusEnabled: false });
  });

  it('encrypts attachments only when the global switch and type policy are enabled', async () => {
    const policy = { getEncryptionMode: vi.fn().mockResolvedValue('enabled') };
    const config = { get: vi.fn().mockResolvedValue(true) };
    const nodes = { findById: vi.fn().mockResolvedValue({ nodeTypeId: 'type-1' }) };
    const resolver = new PostgresResourceSecurityPolicyResolver(policy as never, config as never, nodes as never, {} as never);
    await expect(resolver.resolve('node', 'node-1')).resolves.toEqual({ encryptionEnabled: true, antivirusEnabled: true });
  });

  it('uses the parent node type and explicit disabled encryption for entities', async () => {
    const policy = { getEncryptionMode: vi.fn().mockResolvedValue('disabled') };
    const config = { get: vi.fn().mockResolvedValue(true) };
    const nodes = { findById: vi.fn().mockResolvedValue({ nodeTypeId: 'type-2' }) };
    const entities = { findById: vi.fn().mockResolvedValue({ parentNodeId: 'node-2' }) };
    const resolver = new PostgresResourceSecurityPolicyResolver(policy as never, config as never, nodes as never, entities as never);
    await expect(resolver.resolve('entity', 'entity-1')).resolves.toEqual({ encryptionEnabled: false, antivirusEnabled: true });
    expect(nodes.findById).toHaveBeenCalledWith('node-2');
  });

  it('enforces deployment-required encryption independently of runtime switches', async () => {
    const policy = { getEncryptionMode: vi.fn().mockResolvedValue('disabled') };
    const config = { get: vi.fn().mockResolvedValue(false) };
    const nodes = { findById: vi.fn().mockResolvedValue({ nodeTypeId: 'type-1' }) };
    const resolver = new PostgresResourceSecurityPolicyResolver(policy as never, config as never, nodes as never, {} as never, false, true);
    await expect(resolver.resolve('node', 'node-1')).resolves.toEqual({ encryptionEnabled: true, antivirusEnabled: false });
  });
});
