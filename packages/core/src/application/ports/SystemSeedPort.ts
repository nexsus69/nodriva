export interface SystemSeedPort {
  checkSeeded(): Promise<boolean>;
  seedDatabase(): Promise<void>;
}
