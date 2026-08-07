export interface ConfigurationRecord {
  key: string;
  value: unknown;
  version: number;
  updatedAt?: Date;
}

export interface ConfigurationRepository {
  get(key: string): Promise<ConfigurationRecord | null>;
  set(key: string, value: unknown, expectedVersion: number): Promise<ConfigurationRecord>;
}
