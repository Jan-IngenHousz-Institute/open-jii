import { summarizeExperimentDevices } from "@repo/api/domains/experiment/devices/experiment-devices-summary";
import type { ExperimentDevicesQuery } from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import { deviceRung } from "@repo/api/domains/iot/device-rung";
import type { IotDeviceRung } from "@repo/api/domains/iot/iot.schema";
import { zIotDeviceRung } from "@repo/api/domains/iot/iot.schema";
import { DEFAULT_PAGE_SIZE } from "@repo/api/shared/listing";
import { presentDevice } from "@repo/api/transforms/device-presentation";

import type { ExperimentDeviceEntryDto } from "../../../core/models/experiment-device.model";

export function experimentDevicesPage(
  devices: ExperimentDeviceEntryDto[],
  registeredAt: Map<string, Date>,
  query: Omit<ExperimentDevicesQuery, "id"> & { page: number },
) {
  const { page, pageSize = DEFAULT_PAGE_SIZE } = query;
  const needle = query.search?.trim().toLowerCase() ?? "";
  const statusCounts: Record<IotDeviceRung, number> = {
    registered: 0,
    provisioned: 0,
    onboarded: 0,
    revoked: 0,
    retired: 0,
  };
  const matching = devices.filter((entry) => {
    if (
      query.family?.length &&
      (!entry.device || !query.family.includes(entry.device.deviceType))
    ) {
      return false;
    }
    if (
      needle &&
      ![
        entry.clientId,
        entry.device?.name,
        entry.device?.serialNumber,
        entry.reported?.deviceName,
      ].some((value) => value?.toLowerCase().includes(needle))
    ) {
      return false;
    }
    const status = statusOf(entry);
    if (status) statusCounts[status] += 1;
    return !query.status?.length || (status !== null && query.status.includes(status));
  });

  const sort = query.sort ?? [];
  if (sort.length) {
    matching.sort((a, b) => {
      for (const { field, direction } of sort) {
        let compare: number;
        switch (field) {
          case "name":
            compare = nameOf(a).localeCompare(nameOf(b));
            break;
          case "status":
            compare = statusRank(a) - statusRank(b);
            break;
          case "family":
            compare = (a.device?.deviceType ?? "").localeCompare(b.device?.deviceType ?? "");
            break;
          case "registered":
            compare =
              (registeredAt.get(a.clientId)?.getTime() ?? 0) -
              (registeredAt.get(b.clientId)?.getTime() ?? 0);
            break;
        }
        if (compare !== 0) return direction === "asc" ? compare : -compare;
      }
      return a.clientId.localeCompare(b.clientId);
    });
  }

  const offset = (page - 1) * pageSize;
  const items = matching.slice(offset, offset + pageSize);
  const selected = items.some((entry) => entry.clientId === query.selectedClientId)
    ? undefined
    : devices.find((entry) => entry.clientId === query.selectedClientId);

  return {
    items,
    selected,
    pagination: {
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(matching.length / pageSize)),
      totalCount: matching.length,
      statusCounts,
      summary: summarizeExperimentDevices(devices),
    },
  };
}

function statusOf({ device }: ExperimentDeviceEntryDto): IotDeviceRung | null {
  return device ? deviceRung(device.status, device.boundExperimentCount) : null;
}

function statusRank(entry: ExperimentDeviceEntryDto): number {
  const status = statusOf(entry);
  return status === null ? -1 : zIotDeviceRung.options.indexOf(status);
}

function nameOf(entry: ExperimentDeviceEntryDto): string {
  return entry.device
    ? presentDevice({
        name: entry.device.name,
        id: entry.device.serialNumber,
        family: entry.device.deviceType,
      }).primary
    : (entry.reported?.deviceName ?? entry.clientId);
}
