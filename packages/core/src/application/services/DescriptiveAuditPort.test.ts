import { describe, expect, it, vi } from 'vitest';
import { DescriptiveAuditPort } from './DescriptiveAuditPort.js';
import type { AuditPort } from '../ports/AuditPort.js';

describe('DescriptiveAuditPort', () => {
  it('derives labels from common resource payloads', async () => {
    const delegate: AuditPort = { record: vi.fn().mockResolvedValue(undefined) };
    const port = new DescriptiveAuditPort(delegate);
    await port.record('user-1', 'node.update', 'node', 'node-1', 'node-1', { name: 'Old' }, { name: 'Project Alpha' });
    expect(delegate.record).toHaveBeenCalledWith('user-1', 'node.update', 'node', 'node-1', 'node-1', { name: 'Old' }, { name: 'Project Alpha' }, 'Project Alpha');
  });

  it('preserves explicit labels and leaves technical events without one unlabeled', async () => {
    const delegate: AuditPort = { record: vi.fn().mockResolvedValue(undefined) };
    const port = new DescriptiveAuditPort(delegate);
    await port.record(null, 'lock.acquire', 'node', 'node-1', 'node-1', null, { lockId: 'lock-1' }, null);
    await port.record('user-1', 'system.update_setting', 'system_setting', 'setting-1', null, null, { settingKey: 'session.idleTimeoutSeconds' }, 'Custom label');
    expect(delegate.record).toHaveBeenNthCalledWith(1, null, 'lock.acquire', 'node', 'node-1', 'node-1', null, { lockId: 'lock-1' }, null);
    expect(delegate.record).toHaveBeenNthCalledWith(2, 'user-1', 'system.update_setting', 'system_setting', 'setting-1', null, null, { settingKey: 'session.idleTimeoutSeconds' }, 'Custom label');
  });
});
