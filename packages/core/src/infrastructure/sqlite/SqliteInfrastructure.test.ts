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
});
