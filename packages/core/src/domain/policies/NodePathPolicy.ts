export interface NodePathPolicy {
  generateLabel(name: string): string;
  buildPath(parentPath: string | null, label: string): string;
}
