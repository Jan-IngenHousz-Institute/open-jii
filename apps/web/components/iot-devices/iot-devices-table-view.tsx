"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { IotDeviceStatus, IotDeviceWithConnectivity } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Input } from "@repo/ui/components/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";

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
  const { t } = useTranslation("iot");
  const { openRegister } = useDevicesRegister();
  const { data, isLoading, isError, error } = useIotDevices();
  const devices = useMemo<IotDeviceWithConnectivity[]>(() => data ?? [], [data]);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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

  if (!isLoading && devices.length === 0) {
    return <IotDevicesEmptyState onRegister={openRegister} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">{CHIP_STATUSES.map(renderStatusChip)}</div>
        <div className="relative w-full md:w-[280px]">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
            placeholder={t("iot.devices.searchPlaceholder")}
            className="pl-9"
          />
        </div>
      </div>

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
          {totalPages > 1 && (
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
          )}
        </>
      )}
    </div>
  );
}
