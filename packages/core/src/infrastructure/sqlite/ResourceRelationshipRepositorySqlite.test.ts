/** Runs the canonical relationship-edge persistence contract against SQLite. */

import { afterEach } from 'vitest';
import { resourceRelationshipRepositoryContract } from '../ResourceRelationshipRepository.contract.js';
import { SqliteInfrastructure } from './SqliteInfrastructure.js';

let infrastructure: SqliteInfrastructure | undefined;

afterEach(() => {
  infrastructure?.close();
  infrastructure = undefined;
});

resourceRelationshipRepositoryContract('SQLite', async () => {
  infrastructure = new SqliteInfrastructure(':memory:');
  return infrastructure.resourceRelationshipRepository;
});
