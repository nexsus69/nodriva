import { GlobalViewStore } from './ViewStore';
import { GlobalPolicyRegistry } from './PolicyRegistry';

export class CacheGarbageCollectorService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly defaultWindowedTtl = 5 * 60 * 1000;

  public start(intervalMs: number = 30000, windowedTtlMs?: number) {
    if (this.timer) return;
    
    const ttl = windowedTtlMs || this.defaultWindowedTtl;

    this.timer = setInterval(() => {
      this.sweep(ttl);
    }, intervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Esegue un ciclo manuale di GC sincrono
   */
  public sweep(windowedTtlMs: number = this.defaultWindowedTtl): { evictedKeys: string[] } {
    const keys = GlobalViewStore.getKeys();
    const evictedKeys: string[] = [];

    for (const viewKey of keys) {
      const shouldEvict = GlobalPolicyRegistry.shouldEvict('view', viewKey, windowedTtlMs);
      if (shouldEvict) {
        GlobalViewStore.delete(viewKey);
        GlobalPolicyRegistry.removeTarget('view', viewKey);
        evictedKeys.push(viewKey);
      }
    }

    if (evictedKeys.length > 0) {
      console.log(`[CacheGC] Evicted views: ${evictedKeys.join(', ')}`);
    }

    return { evictedKeys };
  }
}

export const CacheGarbageCollector = new CacheGarbageCollectorService();
