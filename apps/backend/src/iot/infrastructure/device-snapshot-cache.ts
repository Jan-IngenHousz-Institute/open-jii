export const DEVICE_SNAPSHOT_CACHE_MAX_ENTRIES = 16;
const TTL_MS = 30_000;

interface CacheEntry<T> {
  snapshot: T;
  expiresAt: number;
}

export class DeviceSnapshotCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(private readonly isComplete: (snapshot: T) => boolean) {}

  async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      if (cached.expiresAt > Date.now()) {
        this.entries.set(key, cached);
        return cached.snapshot;
      }
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = this.loadAndStore(key, load).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private async loadAndStore(key: string, load: () => Promise<T>): Promise<T> {
    const snapshot = await load();
    if (this.isComplete(snapshot)) this.store(key, snapshot);
    return snapshot;
  }

  private store(key: string, snapshot: T): void {
    const now = Date.now();
    for (const [cachedKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(cachedKey);
    }

    if (this.entries.size >= DEVICE_SNAPSHOT_CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }

    this.entries.set(key, { snapshot, expiresAt: now + TTL_MS });
  }
}
