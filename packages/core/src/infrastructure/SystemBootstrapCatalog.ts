import crypto from 'node:crypto';

export const BOOTSTRAP_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_BOOTSTRAP_ADMIN_EMAIL = 'admin@localhost';

export const SYSTEM_ROLES = [
  { id: '00000000-0000-0000-0000-000000000002', key: 'admin', name: 'admin', description: 'Administrator Role' },
  { id: '00000000-0000-0000-0000-000000000003', key: 'default_reader', name: 'Default Reader', description: 'Base read permissions; data access remains scope-bound.' },
  { id: '00000000-0000-0000-0000-000000000004', key: 'scoped_reader', name: 'Scoped Reader', description: 'Read nodes and entities only within assigned scopes.' },
] as const;

type ResourceKind = 'node' | 'entity' | 'node_type' | 'entity_type' | 'user' | 'role' | 'permission' | 'system_setting';

const permission = (key: string, resourceKind: ResourceKind) => ({
  id: deterministicBootstrapId('permission', key),
  key,
  name: key,
  description: `Allow ${key}`,
  resourceKind,
});

export const SYSTEM_PERMISSIONS = [
  permission('audit.access', 'system_setting'),
  ...['create', 'move', 'edit', 'read', 'delete', 'restore', 'purge'].map((action) => permission(`node.${action}`, 'node')),
  ...['create', 'read', 'edit', 'delete', 'restore', 'purge', 'move'].map((action) => permission(`entity.${action}`, 'entity')),
  ...['read', 'create', 'update', 'delete'].map((action) => permission(`node_type.${action}`, 'node_type')),
  ...['read', 'create', 'update', 'delete'].map((action) => permission(`entity_type.${action}`, 'entity_type')),
  ...['read', 'create', 'update', 'delete', 'assign_roles'].map((action) => permission(`user.${action}`, 'user')),
  ...['read', 'create', 'update', 'delete'].map((action) => permission(`role.${action}`, 'role')),
  ...['read', 'assign', 'delete'].map((action) => permission(`scope.${action}`, 'permission')),
  permission('system.config.read', 'system_setting'),
  permission('system.config', 'system_setting'),
] as const;

export const DEFAULT_READER_PERMISSIONS = ['node_type.read', 'entity_type.read'] as const;
export const SCOPED_READER_PERMISSIONS = ['node.read', 'entity.read'] as const;

export const SYSTEM_SETTINGS = [
  {
    key: 'session.idleTimeoutSeconds', category: 'security', displayName: 'Session inactivity timeout',
    description: 'Maximum inactivity duration in seconds. Heartbeat, polling and lock TTL are derived from this value.',
    valueType: 'integer', valueText: '1800',
  },
  {
    key: 'attachments.antivirusEnabled', category: 'security', displayName: 'Real-time attachment antivirus',
    description: 'Scan uploaded attachments with the configured antivirus service before storage.',
    valueType: 'boolean', valueText: 'false',
  },
  {
    key: 'attachments.encryptionEnabled', category: 'security', displayName: 'Global attachment encryption',
    description: 'Encrypt new attachments unless overridden by the containing node type policy.',
    valueType: 'boolean', valueText: 'false',
  },
  {
    key: 'data.fieldsEncryptionEnabled', category: 'security', displayName: 'Global field encryption',
    description: 'Allow explicit field encryption when global field encryption is enabled.',
    valueType: 'boolean', valueText: 'false',
  },
] as const;

export const RUNTIME_CAPABILITIES = [
  { key: 'hierarchical_structure', name: 'Hierarchical Tree', description: 'Node tree structure', status: 'enabled' },
  { key: 'entities_structure', name: 'Entity Storage', description: 'Dynamic entities structure', status: 'enabled' },
  { key: 'locking', name: 'Concurrency Locking', description: 'Locking controls', status: 'enabled' },
  { key: 'realtime', name: 'Realtime Synchronization', description: 'Realtime synchronization', status: 'enabled' },
] as const;

export function deterministicBootstrapId(namespace: string, key: string): string {
  const hex = crypto.createHash('sha256').update(`dashboard:${namespace}:${key}`).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}
