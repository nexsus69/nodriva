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

  toPrometheus(outbox?: {
    pendingCount: number; leasedCount: number; retryingCount: number; oldestPendingAgeSeconds: number; maxAttempts: number;
  }): string {
    const memory = process.memoryUsage();
    const lines = [
      '# TYPE nodejs_process_resident_memory_bytes gauge',
      `nodejs_process_resident_memory_bytes ${memory.rss}`,
      '# TYPE nodejs_heap_size_total_bytes gauge',
      `nodejs_heap_size_total_bytes ${memory.heapTotal}`,
      '# TYPE nodejs_heap_size_used_bytes gauge',
      `nodejs_heap_size_used_bytes ${memory.heapUsed}`,
      '# TYPE nodejs_external_memory_bytes gauge',
      `nodejs_external_memory_bytes ${memory.external}`,
      '# TYPE nodejs_array_buffers_bytes gauge',
      `nodejs_array_buffers_bytes ${memory.arrayBuffers}`,
      '# TYPE nodejs_process_uptime_seconds gauge',
      `nodejs_process_uptime_seconds ${process.uptime()}`,
      '# TYPE dashboard_realtime_events_total counter',
    ];
    for (const [eventName, bucket] of this.publishing) {
      lines.push(`dashboard_realtime_events_total{event="${eventName}",result="success"} ${bucket.count - bucket.failures}`);
      lines.push(`dashboard_realtime_events_total{event="${eventName}",result="failure"} ${bucket.failures}`);
    }
    if (outbox) {
      lines.push('# TYPE dashboard_realtime_outbox_pending gauge');
      lines.push(`dashboard_realtime_outbox_pending ${outbox.pendingCount}`);
      lines.push('# TYPE dashboard_realtime_outbox_leased gauge');
      lines.push(`dashboard_realtime_outbox_leased ${outbox.leasedCount}`);
      lines.push('# TYPE dashboard_realtime_outbox_retrying gauge');
      lines.push(`dashboard_realtime_outbox_retrying ${outbox.retryingCount}`);
      lines.push('# TYPE dashboard_realtime_outbox_oldest_pending_age_seconds gauge');
      lines.push(`dashboard_realtime_outbox_oldest_pending_age_seconds ${outbox.oldestPendingAgeSeconds}`);
      lines.push('# TYPE dashboard_realtime_outbox_max_attempts gauge');
      lines.push(`dashboard_realtime_outbox_max_attempts ${outbox.maxAttempts}`);
    }
    return `${lines.join('\n')}\n`;
  }
}
