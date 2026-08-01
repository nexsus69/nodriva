export interface TransactionPort {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
