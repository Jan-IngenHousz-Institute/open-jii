"use client";

import { ErrorDisplay } from "@/components/error-display";
import { BulkRegisterIotDevicesDialog } from "@/components/iot-devices/bulk-register-iot-devices-dialog";
import {
  OPEN_DEVICE_BULK_REGISTER_EVENT,
  OPEN_DEVICE_REGISTER_EVENT,
} from "@/components/navigation/site-header/platform-header-events";
import { OverviewToolbar } from "@/components/overview-toolbar";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { useEffect, useMemo, useState } from "react";

import type { IotDeviceStatus, IotDeviceWithConnectivity } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";
import { SearchInput } from "@repo/ui/components/search-input";

import { useDevicesRegister } from "./devices-register-context";
import { IotDevicesEmptyState } from "./iot-devices-empty-state";
import { IotDevicesTable } from "./iot-devices-table";

const PAGE_SIZE = 25;
type StatusFilter = "all" | IotDeviceStatus;

// One-of chips in the group monitoring filter's language, not a tab strip:
// a filter narrows the same list, it does not navigate. Rotating and its kin
// are transient states, not filter axes, so the chips stay at these four.
const CHIP_STATUSES = ["all", "active", "pending", "revoked"] as const;
type ChipStatus = (typeof CHIP_STATUSES)[number];

export function IotDevicesTableView() {
  const { t } = useTranslation(["iot", "common"]);
  const { openRegister } = useDevicesRegister();
  const { data, isLoading, isFetching, isError, error } = useIotDevices();
  const devices = useMemo<IotDeviceWithConnectivity[]>(() => data ?? [], [data]);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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

  const counts = useMemo(
    () => ({
      all: devices.length,
      active: devices.filter((d) => d.status === "active").length,
      pending: devices.filter((d) => d.status === "pending").length,
      revoked: devices.filter((d) => d.status === "revoked").length,
    }),
    [devices],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...devices]
      .filter((d) => status === "all" || d.status === status)
      .filter(
        (d) =>
          q === "" ||
          (d.name?.toLowerCase().includes(q) ?? false) ||
          d.serialNumber.toLowerCase().includes(q) ||
          d.deviceType.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [devices, status, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeStatus = (value: StatusFilter) => {
    setStatus(value);
    setPage(1);
  };
  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const clearFilters = () => {
    setStatus("all");
    setSearch("");
    setPage(1);
  };

  function renderStatusChip(chipStatus: ChipStatus) {
    const isActive = status === chipStatus;
    const label =
      chipStatus === "all" ? t("iot.devices.tabs.all") : t(`iot.devices.status.${chipStatus}`);

    return (
      <Button
        key={chipStatus}
        size="sm"
        variant={isActive ? "default" : "outline"}
        className="h-8"
        onClick={() => {
          changeStatus(chipStatus);
        }}
      >
        {label}
        <span className="ml-1.5 tabular-nums opacity-70">{counts[chipStatus]}</span>
      </Button>
    );
  }

  if (isError) {
    return <ErrorDisplay error={error} title={t("iot.devices.loadError")} />;
  }

  if (!isLoading && devices.length === 0 && search.trim() === "" && status === "all") {
    return (
      <>
        <IotDevicesEmptyState onRegister={openRegister} />
        <BulkRegisterIotDevicesDialog open={bulkOpen} onOpenChange={setBulkOpen} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <OverviewToolbar
        search={
          <SearchInput
            value={search}
            onChange={changeSearch}
            isLoading={search.trim() !== "" && isFetching}
            placeholder={t("iot.devices.searchPlaceholder")}
            clearLabel={t("common.clear")}
            loadingLabel={t("common.loading")}
            className="w-full md:w-[280px]"
          />
        }
        filters={<>{CHIP_STATUSES.map(renderStatusChip)}</>}
      />

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          title={t("iot.devices.zeroResults.title")}
          description={t("iot.devices.zeroResults.description")}
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              {t("iot.devices.zeroResults.clear")}
            </Button>
          }
        />
      ) : (
        <>
          <IotDevicesTable devices={pageRows} isLoading={isLoading} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {t("iot.devices.pageOf", { page: currentPage, total: totalPages })}
            </span>
            <Pagination className="m-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    size="sm"
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    aria-disabled={currentPage <= 1}
                    className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    aria-disabled={currentPage >= totalPages}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </>
      )}

      <BulkRegisterIotDevicesDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}
