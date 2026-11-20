import { useResourceList } from "@/hooks/useResourceList";
import { orpc } from "@/lib/orpc";

import {
  zIotDevicePaginatedList,
  zIotDeviceRung,
  zIotDeviceSort,
} from "@repo/api/domains/iot/iot.schema";
import { zSensorFamily } from "@repo/api/domains/protocol/protocol.schema";

import { iotDeviceListQuery } from "./iot-device-list-query";

const DEVICE_LIST_FILTERS = { status: zIotDeviceRung, family: zSensorFamily };

export function useIotDeviceList() {
  const list = useResourceList({
    searchKey: "q",
    filters: DEVICE_LIST_FILTERS,
    sort: zIotDeviceSort,
    query: (view) =>
      iotDeviceListQuery(orpc, {
        page: view.page,
        search: view.search,
        status: view.filters.status,
        family: view.filters.family,
        sort: view.sort,
      }),
  });
  const statusCounts = zIotDevicePaginatedList.shape.statusCounts.safeParse(
    list.data && "statusCounts" in list.data ? list.data.statusCounts : undefined,
  ).data;

  return { ...list, statusCounts };
}
