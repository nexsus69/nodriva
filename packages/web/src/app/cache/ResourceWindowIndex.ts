/** Indexes canonical resource references to the paged query windows that contain them. */
export interface WindowResourceReference { namespace: string; id: string; }

/** Owns only the bidirectional membership needed for selective window invalidation. */
export class ResourceWindowIndex {
  private readonly windowReferences = new Map<string, WindowResourceReference[]>();
  private readonly referenceWindows = new Map<string, Set<string>>();

  public replaceWindow(windowKey: string, references: readonly WindowResourceReference[]): void {
    this.removeWindow(windowKey);
    const unique = [...new Map(references.map((reference) => [this.referenceKey(reference), reference])).values()];
    this.windowReferences.set(windowKey, unique);
    unique.forEach((reference) => {
      const windows = this.referenceWindows.get(this.referenceKey(reference)) ?? new Set<string>();
      windows.add(windowKey);
      this.referenceWindows.set(this.referenceKey(reference), windows);
    });
  }

  public windowsFor(reference: WindowResourceReference): readonly string[] {
    return [...(this.referenceWindows.get(this.referenceKey(reference)) ?? [])];
  }

  /** Reports whether a canonical record is still retained by any query window. */
  public hasWindowsFor(reference: WindowResourceReference): boolean {
    return (this.referenceWindows.get(this.referenceKey(reference))?.size ?? 0) > 0;
  }

  public removeWindow(windowKey: string): void {
    for (const reference of this.windowReferences.get(windowKey) ?? []) {
      const key = this.referenceKey(reference);
      const windows = this.referenceWindows.get(key);
      windows?.delete(windowKey);
      if (windows?.size === 0) this.referenceWindows.delete(key);
    }
    this.windowReferences.delete(windowKey);
  }

  public clear(): void { this.windowReferences.clear(); this.referenceWindows.clear(); }
  private referenceKey(reference: WindowResourceReference): string { return `${reference.namespace}\u0000${reference.id}`; }
}
