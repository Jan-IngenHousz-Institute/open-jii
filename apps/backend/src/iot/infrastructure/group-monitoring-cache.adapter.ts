import type {
  GroupMonitoringCache,
  GroupMonitoringLoad,
} from "../core/ports/group-monitoring-cache.port";
import { DeviceSnapshotCache } from "./device-snapshot-cache";

export class GroupMonitoringCacheAdapter implements GroupMonitoringCache {
  private readonly cache = new DeviceSnapshotCache<GroupMonitoringLoad>(
    (result) => result.complete,
  );

  async getOrLoad(key: string, load: () => Promise<GroupMonitoringLoad>) {
    const { monitoring } = await this.cache.getOrLoad(key, load);
    return monitoring;
  }
}
