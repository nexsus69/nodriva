export type RealtimeRouteKind = 'data' | 'lock';

interface RealtimeMetricBucket {
  count: number;
  failures: number;
  totalDurationMs: number;
  totalChannels: number;
}

function emptyBucket(): RealtimeMetricBucket {
  return { count: 0, failures: 0, totalDurationMs: 0, totalChannels: 0 };
}

/** Process-local operational metrics. Replace with a shared collector when scaling horizontally. */
export class RealtimeMetrics {
  private readonly routing = new Map<RealtimeRouteKind, RealtimeMetricBucket>();
  private readonly publishing = new Map<string, RealtimeMetricBucket>();

  recordRouting(kind: RealtimeRouteKind, durationMs: number, channelCount: number): void {
    const bucket = this.routing.get(kind) ?? emptyBucket();
    bucket.count += 1;
    bucket.totalDurationMs += durationMs;
    bucket.totalChannels += channelCount;
    this.routing.set(kind, bucket);
  }

  recordPublish(eventName: string, durationMs: number, channelCount: number, success: boolean): void {
    const bucket = this.publishing.get(eventName) ?? emptyBucket();
    bucket.count += 1;
    bucket.totalDurationMs += durationMs;
    bucket.totalChannels += channelCount;
    if (!success) bucket.failures += 1;
    this.publishing.set(eventName, bucket);
  }

  snapshot() {
    const summarize = (bucket: RealtimeMetricBucket) => ({
      count: bucket.count,
      failures: bucket.failures,
      averageDurationMs: bucket.count ? Math.round(bucket.totalDurationMs / bucket.count) : 0,
      averageChannels: bucket.count ? Number((bucket.totalChannels / bucket.count).toFixed(2)) : 0,
    });
    return {
      routing: Object.fromEntries([...this.routing].map(([kind, bucket]) => [kind, summarize(bucket)])),
      publishing: Object.fromEntries([...this.publishing].map(([eventName, bucket]) => [eventName, summarize(bucket)])),
    };
  }
}
