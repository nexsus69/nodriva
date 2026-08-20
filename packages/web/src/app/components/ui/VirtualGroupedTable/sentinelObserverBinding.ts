export interface SentinelObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

export type SentinelObserverFactory = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => SentinelObserverLike;

const browserObserverFactory: SentinelObserverFactory = (callback, options) => (
  new IntersectionObserver(callback, options)
);

export function bindSentinelObserver(
  container: Element,
  topSentinel: Element,
  bottomSentinel: Element,
  onIntersect: IntersectionObserverCallback,
  createObserver: SentinelObserverFactory = browserObserverFactory,
): () => void {
  const observer = createObserver(onIntersect, { root: container, threshold: 0.01 });
  observer.observe(topSentinel);
  observer.observe(bottomSentinel);
  return () => observer.disconnect();
}
