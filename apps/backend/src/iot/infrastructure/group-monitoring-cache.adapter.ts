import type { IotDeviceGroupMonitoring } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import type {
  GroupMonitoringCache,
  GroupMonitoringLoad,
} from "../core/ports/group-monitoring-cache.port";

export const GROUP_MONITORING_CACHE_MAX_ENTRIES = 16;
const TTL_MS = 30_000;

interface CacheEntry {
  monitoring: IotDeviceGroupMonitoring;
  expiresAt: number;
}

export class GroupMonitoringCacheAdapter implements GroupMonitoringCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<IotDeviceGroupMonitoring>>();

  async getOrLoad(
    key: string,
    load: () => Promise<GroupMonitoringLoad>,
  ): Promise<IotDeviceGroupMonitoring> {
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      if (cached.expiresAt > Date.now()) {
        this.entries.set(key, cached);
        return cached.monitoring;
      }
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = this.loadAndStore(key, load).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private async loadAndStore(
    key: string,
    load: () => Promise<GroupMonitoringLoad>,
  ): Promise<IotDeviceGroupMonitoring> {
    const { monitoring, complete } = await load();
    if (complete) this.store(key, monitoring);
    return monitoring;
  }

  private store(key: string, monitoring: IotDeviceGroupMonitoring): void {
    const now = Date.now();
    for (const [cachedKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(cachedKey);
    }

    if (this.entries.size >= GROUP_MONITORING_CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }

    this.entries.set(key, { monitoring, expiresAt: now + TTL_MS });
  }
}
