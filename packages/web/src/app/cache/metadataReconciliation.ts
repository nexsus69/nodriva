type FailureReporter = (message: string, error: unknown) => void;

/** Metadata reconciliation is a recovery path: failure must not break the
 * active view, but it must always be observed instead of becoming an
 * unhandled promise rejection. */
export function reconcileMetadataBestEffort(
  reconcile: () => Promise<void>,
  source: string,
  report: FailureReporter = (message, error) => console.error(message, error),
): void {
  void Promise.resolve()
    .then(reconcile)
    .catch((error) => report(`[MetadataReconciliation] ${source} failed:`, error));
}
