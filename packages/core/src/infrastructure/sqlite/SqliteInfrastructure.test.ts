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
});
