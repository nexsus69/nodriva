import { AppError } from './AppError.js';

export class PlacementPolicyNotFoundError extends AppError {
  constructor(policyKeyOrId: string) {
    super(`Placement Policy '${policyKeyOrId}' not found.`, 'PLACEMENT_POLICY_NOT_FOUND', { policyKeyOrId });
  }
}

export class PlacementPolicyKeyAlreadyExistsError extends AppError {
  constructor(policyKey: string) {
    super(`Placement Policy key '${policyKey}' already exists.`, 'DUPLICATE_PLACEMENT_POLICY_KEY', { policyKey });
  }
}

export class SystemConfigValidationError extends AppError {
  constructor(message: string, issues?: Record<string, string[]>) {
    super(message, 'SYSTEM_CONFIG_VALIDATION_ERROR', { issues });
  }
}
