import { AppError } from '../errors/AppError.js';
import { NodePathPolicy } from './NodePathPolicy.js';

export class InvalidPathLabelError extends AppError {
  constructor(name: string, details?: Record<string, unknown> | undefined) {
    super(
      'INVALID_PATH_LABEL',
      `Cannot generate a valid path label from name: '${name}'. The label must consist of alphanumeric characters and underscores.`,
      { name, ...details }
    );
  }
}

export class LtreeNodePathPolicy implements NodePathPolicy {
  generateLabel(name: string): string {
    let label = name.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    label = label.replace(/_+/g, '_');
    label = label.replace(/^_+|_+$/g, '');

    if (!label || !/^[A-Za-z0-9_]+$/.test(label)) {
      throw new InvalidPathLabelError(name, { generatedLabel: label });
    }

    if (label.length > 120) {
      label = label.substring(0, 120);
    }

    return label;
  }

  buildPath(parentPath: string | null, label: string): string {
    if (!parentPath) {
      return label;
    }
    return `${parentPath}.${label}`;
  }
}
