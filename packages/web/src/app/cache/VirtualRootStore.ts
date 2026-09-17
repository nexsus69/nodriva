/** Stores the currently authorized virtual roots used by browser navigation. */
export class VirtualRootStore {
  private nodeIds = new Set<string>();

  public replace(nodeIds: readonly string[]): void {
    this.nodeIds = new Set(nodeIds);
  }

  public has(nodeId: string): boolean {
    return this.nodeIds.has(nodeId);
  }

  public clear(): void {
    this.nodeIds.clear();
  }
}
