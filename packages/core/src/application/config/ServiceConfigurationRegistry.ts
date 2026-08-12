export type ServiceConfigurationKey =
  | 'database'
  | 'realtime'
  | 'attachment-storage'
  | 'antivirus'
  | 'mail'
  | 'backup'
  | 'observability'
  | 'security-keys';

export type ServiceConfigurationValueType =
  | 'boolean'
  | 'integer'
  | 'string'
  | 'secret-reference';

export type ServiceConfigurationSource = 'runtime' | 'deployment' | 'secret' | 'derived';

export interface ServiceConfigurationFieldDefinition {
  key: string;
  type: ServiceConfigurationValueType;
  source: ServiceConfigurationSource;
  required: boolean;
  secret: boolean;
  clientVisible: boolean;
  restartRequired: boolean;
  description: string;
}

export interface ServiceProviderDefinition {
  key: string;
  displayName: string;
  fields: readonly ServiceConfigurationFieldDefinition[];
}

export interface ServiceConfigurationDefinition {
  key: ServiceConfigurationKey;
  displayName: string;
  capabilityKey?: string;
  providers: readonly ServiceProviderDefinition[];
}

/**
 * Registry metadata for infrastructure services.
 *
 * This registry deliberately contains no values, secrets or persistence
 * logic. It defines the backend contract used later by configuration storage,
 * health checks and administrative views.
 */
export class ServiceConfigurationRegistry {
  private readonly services = new Map<ServiceConfigurationKey, ServiceConfigurationDefinition>();

  constructor(definitions: readonly ServiceConfigurationDefinition[] = []) {
    definitions.forEach((definition) => this.register(definition));
  }

  register(definition: ServiceConfigurationDefinition): void {
    if (this.services.has(definition.key)) {
      throw new Error(`Service configuration '${definition.key}' is already registered.`);
    }
    if (definition.providers.length === 0) {
      throw new Error(`Service configuration '${definition.key}' must define at least one provider.`);
    }

    const providerKeys = new Set<string>();
    for (const provider of definition.providers) {
      if (providerKeys.has(provider.key)) {
        throw new Error(`Provider '${provider.key}' is duplicated for service '${definition.key}'.`);
      }
      providerKeys.add(provider.key);

      const fieldKeys = new Set<string>();
      for (const field of provider.fields) {
        if (fieldKeys.has(field.key)) {
          throw new Error(`Field '${field.key}' is duplicated for provider '${provider.key}'.`);
        }
        fieldKeys.add(field.key);
        if (field.secret && (field.clientVisible || field.source !== 'secret')) {
          throw new Error(`Secret field '${field.key}' must be non-visible and sourced from a secret.`);
        }
      }
    }

    this.services.set(definition.key, definition);
  }

  get(key: ServiceConfigurationKey): ServiceConfigurationDefinition {
    const definition = this.services.get(key);
    if (!definition) throw new Error(`Service configuration '${key}' is not registered.`);
    return definition;
  }

  list(): readonly ServiceConfigurationDefinition[] {
    return [...this.services.values()];
  }
}

const field = (
  key: string,
  type: ServiceConfigurationValueType,
  source: ServiceConfigurationSource,
  options: Pick<ServiceConfigurationFieldDefinition, 'required' | 'secret' | 'clientVisible' | 'restartRequired'>,
  description: string,
): ServiceConfigurationFieldDefinition => ({ key, type, source, ...options, description });

const deploymentString = (key: string, description: string) => field(
  key,
  'string',
  'deployment',
  { required: false, secret: false, clientVisible: false, restartRequired: true },
  description,
);

const secretReference = (key: string, description: string) => field(
  key,
  'secret-reference',
  'secret',
  { required: false, secret: true, clientVisible: false, restartRequired: true },
  description,
);

export const defaultServiceConfigurationRegistry = new ServiceConfigurationRegistry([
  {
    key: 'database',
    displayName: 'Database',
    providers: [
      {
        key: 'postgres',
        displayName: 'PostgreSQL',
        fields: [
          deploymentString('host', 'Hostname o indirizzo del database.'),
          field('port', 'integer', 'deployment', { required: false, secret: false, clientVisible: false, restartRequired: true }, 'Porta del database.'),
          deploymentString('name', 'Nome del database.'),
          deploymentString('user', 'Utente applicativo ristretto.'),
          secretReference('password', 'Riferimento al secret della password.'),
          field('ssl', 'boolean', 'deployment', { required: false, secret: false, clientVisible: false, restartRequired: true }, 'Abilita TLS verso il database.'),
        ],
      },
      {
        key: 'sqlite',
        displayName: 'SQLite',
        fields: [deploymentString('path', 'Percorso del database embedded.')],
      },
    ],
  },
  {
    key: 'realtime',
    displayName: 'Realtime',
    capabilityKey: 'realtime',
    providers: [{
      key: 'soketi',
      displayName: 'Soketi/Pusher-compatible',
      fields: [
        field('enabled', 'boolean', 'runtime', { required: false, secret: false, clientVisible: true, restartRequired: false }, 'Abilita il realtime applicativo.'),
        deploymentString('appId', 'Identificativo applicativo del provider.'),
        deploymentString('cluster', 'Cluster del provider realtime.'),
        deploymentString('internalScheme', 'Schema usato dal backend verso il provider.'),
        deploymentString('internalHost', 'Endpoint raggiungibile dal backend.'),
        field('internalPort', 'integer', 'deployment', { required: false, secret: false, clientVisible: false, restartRequired: true }, 'Porta raggiungibile dal backend.'),
        deploymentString('publicHost', 'Endpoint raggiungibile dal browser.'),
        field('publicPort', 'integer', 'deployment', { required: false, secret: false, clientVisible: false, restartRequired: true }, 'Porta pubblica del realtime.'),
        deploymentString('scheme', 'Schema HTTP o HTTPS pubblico.'),
        field('appKey', 'string', 'deployment', { required: false, secret: false, clientVisible: true, restartRequired: true }, 'Chiave pubblica del provider.'),
        secretReference('appSecret', 'Riferimento al secret del provider.'),
      ],
    }],
  },
  {
    key: 'attachment-storage',
    displayName: 'Attachment storage',
    providers: [{
      key: 'filesystem',
      displayName: 'Filesystem locale',
      fields: [deploymentString('path', 'Percorso dello storage degli allegati.')],
    }, {
      key: 's3-compatible',
      displayName: 'S3 compatible',
      fields: [
        deploymentString('endpoint', 'Endpoint dello storage oggetti.'),
        deploymentString('bucket', 'Bucket degli allegati.'),
        deploymentString('region', 'Regione dello storage.'),
        secretReference('accessKey', 'Riferimento alla chiave di accesso.'),
        secretReference('secretKey', 'Riferimento al secret di accesso.'),
      ],
    }],
  },
  {
    key: 'antivirus',
    displayName: 'Antivirus',
    providers: [{
      key: 'clamav',
      displayName: 'ClamAV',
      fields: [
        field('enabled', 'boolean', 'runtime', { required: false, secret: false, clientVisible: true, restartRequired: false }, 'Abilita la scansione antivirus.'),
        deploymentString('host', 'Hostname del servizio antivirus.'),
        field('port', 'integer', 'deployment', { required: false, secret: false, clientVisible: false, restartRequired: true }, 'Porta del servizio antivirus.'),
        field('timeoutMs', 'integer', 'deployment', { required: false, secret: false, clientVisible: false, restartRequired: true }, 'Timeout della scansione antivirus.'),
        field('failClosed', 'boolean', 'runtime', { required: false, secret: false, clientVisible: true, restartRequired: false }, 'Rifiuta upload quando lo scanner non è disponibile.'),
      ],
    }],
  },
  {
    key: 'mail',
    displayName: 'Mail delivery',
    providers: [{
      key: 'webhook',
      displayName: 'Webhook',
      fields: [
        deploymentString('endpoint', 'Endpoint per la consegna delle email.'),
        deploymentString('publicBaseUrl', 'URL pubblico per i link di completamento.'),
        secretReference('token', 'Riferimento al token del webhook.'),
      ],
    }],
  },
  {
    key: 'backup',
    displayName: 'Backup',
    providers: [{
      key: 'postgres-dump',
      displayName: 'PostgreSQL dump',
      fields: [deploymentString('path', 'Destinazione dei backup verificati.')],
    }],
  },
  {
    key: 'observability',
    displayName: 'Observability',
    providers: [{
      key: 'prometheus',
      displayName: 'Prometheus',
      fields: [deploymentString('endpoint', 'Endpoint di raccolta metriche.')],
    }],
  },
  {
    key: 'security-keys',
    displayName: 'Security keys',
    providers: [{
      key: 'environment',
      displayName: 'Deployment secret environment',
      fields: [
        secretReference('fieldEncryptionKey', 'Chiave attiva per la cifratura dei campi.'),
        secretReference('fieldEncryptionKeys', 'Keyring per la cifratura dei campi.'),
        deploymentString('fieldEncryptionActiveVersion', 'Versione attiva del keyring dei campi.'),
        secretReference('attachmentEncryptionKey', 'Chiave attiva per la cifratura degli allegati.'),
        secretReference('attachmentEncryptionKeys', 'Keyring per la cifratura degli allegati.'),
        deploymentString('attachmentEncryptionActiveVersion', 'Versione attiva del keyring degli allegati.'),
        secretReference('mfaEncryptionKey', 'Chiave per la cifratura dei secret MFA.'),
      ],
    }],
  },
]);
