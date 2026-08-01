import { AppError } from './AppError.js';

export class EntityNotFoundError extends AppError {
  constructor(entityId: string, entityType: string, cause?: unknown) {
    super(
      'ENTITY_NOT_FOUND',
      `Entity of type '${entityType}' with ID '${entityId}' was not found.`,
      { entityId, entityType },
      cause
    );
  }
}

export class NodeNotFoundError extends AppError {
  constructor(nodeId: string, cause?: unknown) {
    super(
      'NODE_NOT_FOUND',
      `Node with ID '${nodeId}' was not found.`,
      { nodeId },
      cause
    );
  }
}

export class PlacementPolicyDeniedError extends AppError {
  constructor(reason: string, details?: Record<string, unknown>, cause?: unknown) {
    super(
      'PLACEMENT_POLICY_DENIED',
      `Placement policy denied action: ${reason}`,
      { reason, ...details },
      cause
    );
  }
}

export class RowVersionMismatchError extends AppError {
  constructor(expected: number, actual: number, cause?: unknown) {
    super(
      'ROW_VERSION_MISMATCH',
      `Resource version mismatch. Expected version: ${expected}, but got actual version: ${actual}.`,
      { expected, actual },
      cause
    );
  }
}

export class LockRequiredError extends AppError {
  constructor(resourceKind: string, resourceId: string, cause?: unknown) {
    super(
      'LOCK_REQUIRED',
      `An active lock is required to modify this ${resourceKind} (ID: ${resourceId}).`,
      { resourceKind, resourceId },
      cause
    );
  }
}

export class NodeTypeNotFoundError extends AppError {
  constructor(typeKey: string, cause?: unknown) {
    super(
      'NODE_TYPE_NOT_FOUND',
      `Node type with key '${typeKey}' was not found.`,
      { typeKey },
      cause
    );
  }
}

export class NodePathCollisionError extends AppError {
  constructor(parentId: string | null, pathLabel: string, cause?: unknown) {
    super(
      'NODE_PATH_COLLISION',
      `A node with path label '${pathLabel}' already exists under parent ${parentId ? `'${parentId}'` : 'root'}.`,
      { parentId, pathLabel },
      cause
    );
  }
}

export class NodeCyclicMoveError extends AppError {
  constructor(nodeId: string, targetParentId: string, cause?: unknown) {
    super(
      'NODE_CYCLIC_MOVE',
      `Cannot move node '${nodeId}' under '${targetParentId}' because it would create a cycle in the hierarchy.`,
      { nodeId, targetParentId },
      cause
    );
  }
}

