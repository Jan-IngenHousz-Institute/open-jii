import type { QueryUtils } from "@/lib/orpc";

import type { IotDeviceFilterQuery } from "@repo/api/domains/iot/iot.schema";

export function iotDeviceListQuery(
  utils: QueryUtils,
  view: IotDeviceFilterQuery & { page: number },
) {
  return utils.iot.listIotDevices.queryOptions({
    input: {
      page: view.page,
      search: view.search?.trim() ? view.search : undefined,
      status: view.status?.length ? view.status : undefined,
      family: view.family?.length ? view.family : undefined,
      sort: view.sort?.length ? view.sort : undefined,
    },
  });
}
