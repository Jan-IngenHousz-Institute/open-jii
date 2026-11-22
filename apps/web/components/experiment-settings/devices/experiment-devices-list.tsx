"use client";

import { ConnectivityDot } from "@/components/iot-devices/device-connectivity";
import { DeviceIdentity } from "@/components/iot-devices/device-row";
import { IotDeviceStatusBadge } from "@/components/iot-devices/iot-device-status-badge";
import { ListFilterBar } from "@/components/list-filter-bar";
import { ListPagination } from "@/components/list-pagination";
import { ResetSortingButton } from "@/components/overview-table/reset-sorting-button";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { ArrowDown, ArrowUp, ArrowUpDown, CircleDot, Layers, Lock } from "lucide-react";

import type { ExperimentDeviceEntry } from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import type { IotDeviceSort } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { SearchInput } from "@repo/ui/components/search-input";
import { cn } from "@repo/ui/lib/utils";

import type { ExperimentDevicesListModel } from "./use-experiment-devices-list";

interface ExperimentDevicesListProps {
  list: ExperimentDevicesListModel;
  selectedClientId: string | null;
  onSelect: (clientId: string) => void;
}

/** Rows compose `DeviceIdentity`: `DeviceRow`'s `selection` prop is multi-select grammar. */
export function ExperimentDevicesList({
  list,
  selectedClientId,
  onSelect,
}: ExperimentDevicesListProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const pageRows = list.data?.items ?? [];

  function renderSortHeader(field: IotDeviceSort[number]["field"], label: string) {
    const index = list.sort.findIndex((item) => item.field === field);
    const direction = list.sort.find((item) => item.field === field)?.direction;
    const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
    const state =
      direction === "asc"
        ? "sortAscending"
        : direction === "desc"
          ? "sortDescending"
          : "sortUnsorted";
    return (
      <button
        type="button"
        className="hover:text-foreground inline-flex items-center gap-1 text-left text-[11px] font-semibold uppercase focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={`${label}: ${tCommon(`common.${state}`)}${index > 0 ? `, ${tCommon("common.sortSecondary")}` : ""}`}
        onClick={(event) => list.toggleSort(field, event.shiftKey)}
      >
        {label}
        <Icon aria-hidden className="size-3.5" />
        {index > 0 && <span aria-hidden>2</span>}
      </button>
    );
  }

  function renderRow(entry: ExperimentDeviceEntry) {
    const isSelected = entry.clientId === selectedClientId;

    return (
      <li key={entry.clientId}>
        <button
          type="button"
          aria-current={isSelected ? "true" : undefined}
          onClick={() => {
            onSelect(entry.clientId);
          }}
          className={cn(
            "hover:bg-muted/50 relative flex w-full min-w-0 flex-col gap-1.5 px-3 py-2.5 text-left transition-colors",
            isSelected &&
              "bg-muted before:bg-primary before:absolute before:inset-y-0 before:left-0 before:w-0.5",
          )}
        >
          <span className="flex w-full min-w-0 items-start justify-between gap-2">
            {entry.device === null ? (
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {entry.reported?.deviceName ?? t("iot.experimentDevices.unregistered")}
                </span>
                <span className="text-muted-foreground truncate font-mono text-xs">
                  {entry.clientId}
                </span>
              </span>
            ) : (
              <DeviceIdentity device={entry.device} showSerial />
            )}
            {entry.device && (
              <span className="text-muted-foreground shrink-0 text-xs">
                {getSensorFamilyLabel(entry.device.deviceType)}
              </span>
            )}
          </span>

          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {entry.device !== null && (
              <IotDeviceStatusBadge
                status={entry.device.status}
                deviceType={entry.device.deviceType}
                boundExperimentCount={entry.device.boundExperimentCount}
              />
            )}
            {entry.device !== null && (
              <ConnectivityDot
                connectivity={entry.connectivity}
                deviceType={entry.device.deviceType}
              />
            )}
            {!entry.canView && (
              <span
                className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                title={t("iot.experimentDevices.noAccess")}
              >
                <Lock className="size-3" aria-hidden />
                {t("iot.experimentDevices.noAccessShort")}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="space-y-3 p-3">
        <ListFilterBar
          search={
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              isLoading={list.isSearchPending}
              placeholder={t("iot.experimentDevices.searchPlaceholder")}
              className="w-full"
            />
          }
          filters={[
            {
              key: "status",
              label: t("iot.devices.columns.status"),
              icon: CircleDot,
              options: list.filterShape.status.options.map((value) => ({
                value,
                label: t(`iot.devices.status.${value}`),
                count: list.response?.overview.pagination?.statusCounts[value],
              })),
              selected: list.filters.status,
              onChange: (values) =>
                list.setFilter("status", list.filterShape.status.array().parse(values)),
            },
            {
              key: "deviceFamily",
              label: t("iot.devices.columns.family"),
              icon: Layers,
              options: list.filterShape.deviceFamily.options.map((value) => ({
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
      </div>
      <div className="border-border text-muted-foreground flex flex-wrap justify-between gap-2 border-t px-3 py-2">
        {renderSortHeader("name", t("iot.devices.columns.name"))}
        {renderSortHeader("status", t("iot.devices.columns.status"))}
        {renderSortHeader("family", t("iot.devices.columns.family"))}
        {renderSortHeader("registered", t("iot.devices.columns.created"))}
      </div>

      {pageRows.length === 0 ? (
        <div className="text-muted-foreground border-border space-y-3 border-t px-3 py-6 text-center text-sm">
          <p>
            {t(
              list.hasActiveFilters
                ? "iot.devices.zeroResults.title"
                : "iot.experimentDevices.searchNoMatches",
            )}
          </p>
          {(list.hasActiveFilters || list.search.trim() !== "") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                list.clearFilters();
                list.setSearch("");
              }}
            >
              {tCommon("common.clearFilters")}
            </Button>
          )}
        </div>
      ) : (
        <ScrollArea className="border-border max-h-128 overflow-y-auto border-t">
          <ul className="divide-border min-w-0 divide-y">{pageRows.map(renderRow)}</ul>
        </ScrollArea>
      )}

      {list.data && pageRows.length > 0 && (
        <div className="border-border border-t px-3 py-2">
          <ListPagination
            page={list.data.page}
            totalPages={list.data.totalPages}
            onPageChange={list.setPage}
          />
        </div>
      )}
    </div>
  );
}
