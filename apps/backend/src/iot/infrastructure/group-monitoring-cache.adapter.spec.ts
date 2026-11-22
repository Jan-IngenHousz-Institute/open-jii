import type { IotDeviceGroupMonitoring } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import type { GroupMonitoringLoad } from "../core/ports/group-monitoring-cache.port";
import {
  GROUP_MONITORING_CACHE_MAX_ENTRIES,
  GroupMonitoringCacheAdapter,
} from "./group-monitoring-cache.adapter";

const monitoring: IotDeviceGroupMonitoring = {
  members: [],
  throughput: [],
  dataByExperiment: [],
  firmware: [],
  events: [],
  pipelineUnavailable: false,
};

describe("GroupMonitoringCacheAdapter", () => {
  let cache: GroupMonitoringCacheAdapter;
  const load = vi.fn<() => Promise<GroupMonitoringLoad>>();

  beforeEach(() => {
    cache = new GroupMonitoringCacheAdapter();
    load.mockReset().mockResolvedValue({ monitoring, complete: true });
  });

  it("evicts least recently used snapshots once the cache reaches its bound", async () => {
    for (let index = 0; index < GROUP_MONITORING_CACHE_MAX_ENTRIES; index += 1) {
      await cache.getOrLoad(`window-${index}`, load);
    }
    await cache.getOrLoad("window-0", load);
    await cache.getOrLoad("new-window", load);
    await cache.getOrLoad("window-0", load);
    await cache.getOrLoad("new-window", load);
    expect(load).toHaveBeenCalledTimes(GROUP_MONITORING_CACHE_MAX_ENTRIES + 1);

    await cache.getOrLoad("window-1", load);
    expect(load).toHaveBeenCalledTimes(GROUP_MONITORING_CACHE_MAX_ENTRIES + 2);
  });

  it("expires a snapshot 30 seconds after loading even if it was recently read", async () => {
    vi.useFakeTimers();
    try {
      await cache.getOrLoad("window", load);
      vi.advanceTimersByTime(29_999);
      await cache.getOrLoad("window", load);
      expect(load).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      await cache.getOrLoad("window", load);
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shares a load with concurrent callers and retries an incomplete result on the next call", async () => {
    const incomplete = { ...monitoring, pipelineUnavailable: true };
    load.mockResolvedValueOnce({ monitoring: incomplete, complete: false });

    const first = cache.getOrLoad("window", load);
    const second = cache.getOrLoad("window", load);

    expect(await Promise.all([first, second])).toEqual([incomplete, incomplete]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(await cache.getOrLoad("window", load)).toEqual(monitoring);
    expect(await cache.getOrLoad("window", load)).toEqual(monitoring);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
