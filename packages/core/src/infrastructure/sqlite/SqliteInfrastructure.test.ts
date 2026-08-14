import { describe, expect, it } from 'vitest';
import { SqliteInfrastructure } from './SqliteInfrastructure.js';

describe('SqliteInfrastructure', () => {
  it('initializes one coherent standalone composition root', () => {
    const infrastructure = new SqliteInfrastructure();
    expect(infrastructure.nodeRepository).toBeDefined();
    expect(infrastructure.accessControlPort).toBeDefined();
    expect(infrastructure.userRepository).toBeDefined();
    expect(infrastructure.database.get('SELECT 1 AS ready')).toEqual({ ready: 1 });
    infrastructure.close();
  });

  it('normalizes driver rows to plain objects at the adapter boundary', () => {
    const infrastructure = new SqliteInfrastructure();
    const row = infrastructure.database.get<{ value: number }>('SELECT 1 AS value');
    const rows = infrastructure.database.all<{ value: number }>('SELECT 1 AS value UNION ALL SELECT 2 AS value');

    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    expect(rows.map((item) => Object.getPrototypeOf(item))).toEqual([
      Object.prototype,
      Object.prototype,
    ]);
    infrastructure.close();
  });

  it('bootstraps a fresh standalone database when administrator credentials are configured', async () => {
    const previousPassword = process.env.SEED_ADMIN_PASSWORD;
    const previousEmail = process.env.SEED_ADMIN_EMAIL;
    process.env.SEED_ADMIN_PASSWORD = 'Standalone-bootstrap-2026!';
    process.env.SEED_ADMIN_EMAIL = 'standalone@example.test';
    try {
      const infrastructure = new SqliteInfrastructure();
      expect(infrastructure.database.get("SELECT 1 FROM users WHERE email='standalone@example.test' AND is_super_admin=1")).toBeTruthy();
      await expect(infrastructure.systemSeedService.checkSeeded()).resolves.toBe(true);
      infrastructure.close();
    } finally {
      if (previousPassword === undefined) delete process.env.SEED_ADMIN_PASSWORD;
      else process.env.SEED_ADMIN_PASSWORD = previousPassword;
      if (previousEmail === undefined) delete process.env.SEED_ADMIN_EMAIL;
      else process.env.SEED_ADMIN_EMAIL = previousEmail;
    }
  });
});
