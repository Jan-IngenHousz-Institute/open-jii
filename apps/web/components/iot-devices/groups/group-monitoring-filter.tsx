"use client";

import { ListFilterBar } from "@/components/list-filter-bar";
import { ResetSortingButton } from "@/components/overview-table/reset-sorting-button";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Activity, Layers } from "lucide-react";

import { zDeviceType } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { SearchInput } from "@repo/ui/components/search-input";

import type { GroupDevicesList } from "./use-group-devices-list";

export function GroupMonitoringFilter({ list }: { list: GroupDevicesList }) {
  const { t } = useTranslation("iot");

  return (
    <ListFilterBar
      search={
        <SearchInput
          value={list.search}
          onChange={list.setSearch}
          isLoading={list.isSearchPending}
          placeholder={t("iot.groups.monitoring.filter.searchPlaceholder")}
        />
      }
      filters={[
        {
          key: "groupHealth",
          icon: Activity,
          label: t("iot.groups.monitoring.stateColumn"),
          options: [
            { value: "online", label: t("iot.groups.monitoring.onlineLabel") },
            { value: "offline", label: t("iot.groups.monitoring.filter.offline") },
            { value: "unknown", label: t("iot.groups.monitoring.unknownLabel") },
            { value: "silent", label: t("iot.groups.monitoring.filter.silent") },
          ],
          selected: list.filters.groupHealth,
          onChange: (values) =>
            list.setFilter("groupHealth", list.filterShape.groupHealth.array().parse(values)),
        },
        {
          key: "deviceFamily",
          icon: Layers,
          label: t("iot.devices.columns.family"),
          options: zDeviceType.options.map((value) => ({
            value,
            label: getSensorFamilyLabel(value),
          })),
          selected: list.filters.deviceFamily,
          onChange: (values) =>
            list.setFilter("deviceFamily", list.filterShape.deviceFamily.array().parse(values)),
        },
      ]}
      onClearFilters={list.clearFilters}
      actions={
        <ResetSortingButton active={list.sort.length > 0} onReset={() => list.setSort([])} />
      }
    />
  );
}
