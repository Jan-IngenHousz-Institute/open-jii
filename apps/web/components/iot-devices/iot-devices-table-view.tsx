"use client";

import { BulkRegisterIotDevicesDialog } from "@/components/iot-devices/bulk-register-iot-devices-dialog";
import { ListFilterBar } from "@/components/list-filter-bar";
import { ListPagination } from "@/components/list-pagination";
import {
  OPEN_DEVICE_BULK_REGISTER_EVENT,
  OPEN_DEVICE_REGISTER_EVENT,
} from "@/components/navigation/site-header/platform-header-events";
import { ResetSortingButton } from "@/components/overview-table/reset-sorting-button";
import { useIotDeviceList } from "@/hooks/iot/useIotDeviceList/useIotDeviceList";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { CircleDot, Layers } from "lucide-react";
import { useEffect, useState } from "react";

import { zIotDeviceRung } from "@repo/api/domains/iot/iot.schema";
import { zSensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import type { ListFilter } from "@repo/ui/components/list-filter-menu";
import { SearchInput } from "@repo/ui/components/search-input";

import { useDevicesRegister } from "./devices-register-context";
import { IotDevicesEmptyState } from "./iot-devices-empty-state";
import { IotDevicesTable } from "./iot-devices-table";

export function IotDevicesTableView() {
  const { t } = useTranslation(["iot", "common"]);
  const { openRegister } = useDevicesRegister();
  const list = useIotDeviceList();
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const openBulkRegister = () => setBulkOpen(true);
    window.addEventListener(OPEN_DEVICE_BULK_REGISTER_EVENT, openBulkRegister);
    window.addEventListener(OPEN_DEVICE_REGISTER_EVENT, openRegister);
    return () => {
      window.removeEventListener(OPEN_DEVICE_BULK_REGISTER_EVENT, openBulkRegister);
      window.removeEventListener(OPEN_DEVICE_REGISTER_EVENT, openRegister);
    };
  }, [openRegister]);

  const filters: ListFilter[] = [
    {
      key: "status",
      label: t("iot.devices.columns.status"),
      icon: CircleDot,
      options: zIotDeviceRung.options.map((value) => ({
        value,
        label: t(`iot.devices.status.${value}`),
        count: list.statusCounts?.[value],
      })),
      selected: list.filters.status,
      onChange: (values) => list.setFilter("status", zIotDeviceRung.array().parse(values)),
    },
    {
      key: "family",
      label: t("iot.devices.columns.family"),
      icon: Layers,
      options: zSensorFamily.options.map((value) => ({
        value,
        label: getSensorFamilyLabel(value),
      })),
      selected: list.filters.family,
      onChange: (values) => list.setFilter("family", zSensorFamily.array().parse(values)),
    },
  ];
  const hasSearch = list.search.trim() !== "";
  const isEmpty = !list.isLoading && list.data?.totalCount === 0;

  if (
    isEmpty &&
    !list.error &&
    !list.isPlaceholderData &&
    list.search === list.debouncedSearch &&
    !hasSearch &&
    !list.hasActiveFilters
  ) {
    return (
      <>
        <IotDevicesEmptyState onRegister={openRegister} />
        {bulkOpen && <BulkRegisterIotDevicesDialog open={bulkOpen} onOpenChange={setBulkOpen} />}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <ListFilterBar
        searchWidth="wide"
        search={
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            isLoading={list.isSearchPending}
            placeholder={t("iot.devices.searchPlaceholder")}
            clearLabel={t("common.clear")}
            loadingLabel={t("common.loading")}
          />
        }
        filters={filters}
        onClearFilters={list.clearFilters}
        actions={
          <ResetSortingButton active={list.sort.length > 0} onReset={() => list.setSort([])} />
        }
      />

      <div
        aria-busy={list.isPlaceholderData}
        inert={list.isPlaceholderData}
        className={`space-y-4 transition-opacity ${list.isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        {list.error ? (
          <EmptyState
            size="inline"
            variant="error"
            description={t("iot.devices.loadError")}
            action={
              <Button variant="outline" size="sm" onClick={() => void list.refetch()}>
                {t("errors.tryAgain")}
              </Button>
            }
          />
        ) : isEmpty ? (
          <EmptyState
            title={t("iot.devices.zeroResults.title")}
            description={t("iot.devices.zeroResults.description")}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  list.clearFilters();
                  list.setSearch("");
                }}
              >
                {t("iot.devices.zeroResults.clear")}
              </Button>
            }
          />
        ) : (
          <>
            <IotDevicesTable
              devices={list.data?.items ?? []}
              isLoading={list.isLoading}
              sorting={{ sort: list.sort, onToggle: list.toggleSort }}
            />
            {list.data && (
              <ListPagination
                page={list.page}
                totalPages={list.data.totalPages}
                onPageChange={list.setPage}
              />
            )}
          </>
        )}
      </div>

      {bulkOpen && <BulkRegisterIotDevicesDialog open={bulkOpen} onOpenChange={setBulkOpen} />}
    </div>
  );
}
