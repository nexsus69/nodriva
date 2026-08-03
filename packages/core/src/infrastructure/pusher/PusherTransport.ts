import Pusher from 'pusher';

export interface PusherTransportConfig {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
  useTLS?: boolean;
  host?: string;
  port?: string;
  enabled?: boolean;
}

export interface PusherTransportPort {
  readonly enabled: boolean;
  trigger(channelName: string, eventName: string, payload: unknown): Promise<void>;
}

/** The only class in Core allowed to depend on the Pusher SDK. */
export class PusherTransport implements PusherTransportPort {
  private readonly client: Pusher | null;

  constructor(config: PusherTransportConfig) {
    const enabled = config.enabled !== false && Boolean(config.appId && config.key && config.secret && config.cluster);
    this.client = enabled
      ? new Pusher({
          appId: config.appId,
          key: config.key,
          secret: config.secret,
          cluster: config.cluster,
          useTLS: config.useTLS ?? true,
          host: config.host,
          port: config.port,
        })
      : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async trigger(channelName: string, eventName: string, payload: unknown): Promise<void> {
    if (!this.client) return;
    await this.client.trigger(channelName, eventName, payload);
  }
}

