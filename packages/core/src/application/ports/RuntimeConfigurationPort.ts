export interface RuntimeConfigurationPort {
  isCapabilityEnabled(capabilityKey: string): Promise<boolean>;
  getSetting<T>(settingKey: string, defaultValue: T): Promise<T>;
}
