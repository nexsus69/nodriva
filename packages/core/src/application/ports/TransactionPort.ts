export interface TransactionPort {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
  /** Serializes an authorization-policy change against protected mutations. */
  runInAuthorizationMutation<T>(work: () => Promise<T>): Promise<T>;
  /**
   * Schedules a side effect only after the outermost transaction commits.
   * Implementations without transaction support may execute it immediately.
   */
  afterCommit?(effect: () => void | Promise<void>): void;
}
