"use client";

import type { MonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { useResourceList } from "@/hooks/useResourceList";
import { orpc } from "@/lib/orpc";
import { partialMatchKey } from "@tanstack/react-query";

import {
  zGroupMemberHealth,
  zGroupMonitoringSort,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { zDeviceType } from "@repo/api/domains/iot/iot.schema";

const FILTERS = { groupHealth: zGroupMemberHealth, deviceFamily: zDeviceType };

export function useGroupDevicesList(groupId: string, range: MonitoringRange) {
  const window = { groupId, from: range.from, to: range.to, bucket: range.bucket };
  const windowKey = orpc.iot.getIotDeviceGroupMonitoring.queryKey({ input: window });

  return useResourceList({
    searchKey: "q",
    filters: FILTERS,
    sort: zGroupMonitoringSort,
    query: ({ page, search, sort, filters }) =>
      orpc.iot.getIotDeviceGroupMonitoring.queryOptions({
        input: {
          ...window,
          page,
          search: search.trim() ? search : undefined,
          health: filters.groupHealth.length ? filters.groupHealth : undefined,
          family: filters.deviceFamily.length ? filters.deviceFamily : undefined,
          sort: sort.length ? sort : undefined,
        },
        // Buckets from another window would not line up with the current chart axes.
        placeholderData: (previous, previousQuery) =>
          previousQuery && partialMatchKey(previousQuery.queryKey, windowKey)
            ? previous
            : undefined,
        select: (monitoring) => ({
          items: monitoring.members,
          page: monitoring.pagination?.page ?? 1,
          pageSize: monitoring.pagination?.pageSize ?? monitoring.members.length,
          totalPages: monitoring.pagination?.totalPages ?? 1,
          totalCount: monitoring.pagination?.totalCount ?? monitoring.members.length,
          monitoring,
        }),
      }),
  });
}

export type GroupDevicesList = ReturnType<typeof useGroupDevicesList>;
