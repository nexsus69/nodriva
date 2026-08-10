export type ConfigurationSource = 'runtime' | 'deployment' | 'secret' | 'derived';
export type ConfigurationValueType = 'integer' | 'decimal' | 'boolean' | 'string' | 'json';

export interface ConfigurationDefinition<T> {
  key: string;
  type: ConfigurationValueType;
  defaultValue: T;
  source: ConfigurationSource;
  clientVisible: boolean;
  validate(value: T): void;
}

export class ConfigurationRegistry {
  private readonly definitions = new Map<string, ConfigurationDefinition<unknown>>();

  constructor(definitions: readonly ConfigurationDefinition<unknown>[] = []) {
    definitions.forEach((definition) => this.register(definition));
  }

  register<T>(definition: ConfigurationDefinition<T>): void {
    if (this.definitions.has(definition.key)) {
      throw new Error(`Configuration key '${definition.key}' is already registered.`);
    }
    this.definitions.set(definition.key, definition as ConfigurationDefinition<unknown>);
  }

  get<T>(key: string): ConfigurationDefinition<T> {
    const definition = this.definitions.get(key);
    if (!definition) throw new Error(`Configuration key '${key}' is not registered.`);
    return definition as ConfigurationDefinition<T>;
  }
}

const integerInRange = (min: number, max: number) => (value: number): void => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Configuration value must be an integer between ${min} and ${max}.`);
  }
};

export const sessionIdleTimeoutDefinition: ConfigurationDefinition<number> = {
  key: 'session.idleTimeoutSeconds',
  type: 'integer',
  defaultValue: 300,
  source: 'runtime',
  clientVisible: true,
  validate: integerInRange(60, 86_400),
};

export const attachmentAntivirusEnabledDefinition: ConfigurationDefinition<boolean> = {
  key: 'attachments.antivirusEnabled',
  type: 'boolean',
  defaultValue: false,
  source: 'runtime',
  clientVisible: false,
  validate: (value) => {
    if (typeof value !== 'boolean') throw new Error('Attachment antivirus setting must be boolean.');
  },
};

export const attachmentEncryptionEnabledDefinition: ConfigurationDefinition<boolean> = {
  key: 'attachments.encryptionEnabled',
  type: 'boolean',
  defaultValue: false,
  source: 'runtime',
  clientVisible: false,
  validate: (value) => {
    if (typeof value !== 'boolean') throw new Error('Attachment encryption setting must be boolean.');
  },
};

export const fieldEncryptionEnabledDefinition: ConfigurationDefinition<boolean> = {
  key: 'data.fieldsEncryptionEnabled',
  type: 'boolean',
  defaultValue: false,
  source: 'runtime',
  clientVisible: false,
  validate: (value) => {
    if (typeof value !== 'boolean') throw new Error('Field encryption setting must be boolean.');
  },
};

export const defaultConfigurationRegistry = new ConfigurationRegistry([
  sessionIdleTimeoutDefinition,
  attachmentAntivirusEnabledDefinition,
  attachmentEncryptionEnabledDefinition,
  fieldEncryptionEnabledDefinition,
]);
