"use client";

import { useResourceList } from "@/hooks/useResourceList";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { z } from "zod";

import type { ExperimentDeviceEntry } from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import { zDeviceType } from "@repo/api/domains/iot/iot.schema";
import { zListSort } from "@repo/api/shared/listing";
import { useTranslation } from "@repo/i18n";

const FILTERS = { deviceFamily: zDeviceType };
const SORT = zListSort(z.enum(["name", "family"]));

const EMPTY_DEVICES: ExperimentDeviceEntry[] = [];

export function useExperimentDevicesList({
  experimentId,
  devices = EMPTY_DEVICES,
  dataUpdatedAt,
}: {
  experimentId: string;
  devices?: ExperimentDeviceEntry[];
  dataUpdatedAt: number;
}) {
  const { t } = useTranslation("iot");
  const labelFor = (entry: ExperimentDeviceEntry) =>
    entry.device
      ? resolveDeviceLabel(entry.device, t)
      : (entry.reported?.deviceName ?? entry.clientId);
  const familyFor = (entry: ExperimentDeviceEntry) =>
    entry.device ? getSensorFamilyLabel(entry.device.deviceType) : "";

  return useResourceList({
    searchKey: "q",
    filters: FILTERS,
    sort: SORT,
    query: (view) => ({
      queryKey: ["experiment-devices-list", experimentId, dataUpdatedAt],
      queryFn: () => devices,
      initialData: devices,
      staleTime: Infinity,
      select: (rows: ExperimentDeviceEntry[]) => {
        const needle = view.search.trim().toLowerCase();
        const matching = rows.filter(
          (entry) =>
            (view.filters.deviceFamily.length === 0 ||
              (entry.device !== null &&
                view.filters.deviceFamily.includes(entry.device.deviceType))) &&
            [
              entry.clientId,
              entry.device?.name,
              entry.device?.serialNumber,
              entry.reported?.deviceName,
            ].some((value) => value?.toLowerCase().includes(needle)),
        );
        if (view.sort.length === 0) return matching;
        return matching.sort((a, b) => {
          for (const { field, direction } of view.sort) {
            const compare =
              field === "name"
                ? labelFor(a).localeCompare(labelFor(b))
                : familyFor(a).localeCompare(familyFor(b));
            if (compare !== 0) return direction === "asc" ? compare : -compare;
          }
          return 0;
        });
      },
    }),
  });
}

export type ExperimentDevicesListModel = ReturnType<typeof useExperimentDevicesList>;
