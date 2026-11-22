"use client";

import { useResourceList } from "@/hooks/useResourceList";
import { orpc } from "@/lib/orpc";

import { zDeviceType, zIotDeviceRung, zIotDeviceSort } from "@repo/api/domains/iot/iot.schema";

const FILTERS = { status: zIotDeviceRung, deviceFamily: zDeviceType };

export function useExperimentDevicesList(experimentId: string) {
  return useResourceList({
    searchKey: "q",
    filters: FILTERS,
    sort: zIotDeviceSort,
    query: ({ page, search, sort, filters }) =>
      orpc.experiments.listExperimentDevices.queryOptions({
        input: {
          id: experimentId,
          page,
          search: search.trim() ? search : undefined,
          status: filters.status.length ? filters.status : undefined,
          family: filters.deviceFamily.length ? filters.deviceFamily : undefined,
          sort: sort.length ? sort : undefined,
        },
        select: (overview) => ({
          items: overview.devices,
          page: overview.pagination?.page ?? 1,
          pageSize: overview.pagination?.pageSize ?? overview.devices.length,
          totalPages: overview.pagination?.totalPages ?? 1,
          totalCount: overview.pagination?.totalCount ?? overview.devices.length,
          overview,
        }),
      }),
  });
}

export type ExperimentDevicesListModel = ReturnType<typeof useExperimentDevicesList>;
