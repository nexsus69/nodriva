import { AppError } from './AppError.js';

export class PlacementPolicyNotFoundError extends AppError {
  constructor(policyKeyOrId: string) {
    super('PLACEMENT_POLICY_NOT_FOUND', `Placement Policy '${policyKeyOrId}' not found.`, { policyKeyOrId });
  }
}

export class PlacementPolicyKeyAlreadyExistsError extends AppError {
  constructor(policyKey: string) {
    super('DUPLICATE_PLACEMENT_POLICY_KEY', `Placement Policy key '${policyKey}' already exists.`, { policyKey });
  }
}

export class SystemConfigValidationError extends AppError {
  constructor(message: string, issues?: Record<string, string[]>) {
    super('SYSTEM_CONFIG_VALIDATION_ERROR', message, { issues });
  }
}
