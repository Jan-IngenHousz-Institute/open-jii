"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { IotDevice, IotDeviceStatus } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";
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

export function IotDevicesTableView() {
  const { t } = useTranslation("iot");
  const { openRegister } = useDevicesRegister();
  const { data, isLoading, isError, error } = useIotDevices();
  const devices = useMemo<IotDevice[]>(() => data ?? [], [data]);

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

  const changeStatus = (value: string) => {
    setStatus(value as StatusFilter);
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

  if (isError) {
    return <ErrorDisplay error={error} title={t("iot.devices.loadError")} />;
  }

  if (!isLoading && devices.length === 0) {
    return <IotDevicesEmptyState onRegister={openRegister} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <NavTabs value={status} onValueChange={changeStatus}>
          <NavTabsList>
            <NavTabsTrigger value="all" count={counts.all}>
              {t("iot.devices.tabs.all")}
            </NavTabsTrigger>
            <NavTabsTrigger value="active" count={counts.active}>
              {t("iot.devices.status.active")}
            </NavTabsTrigger>
            <NavTabsTrigger value="pending" count={counts.pending}>
              {t("iot.devices.status.pending")}
            </NavTabsTrigger>
            <NavTabsTrigger value="revoked" count={counts.revoked}>
              {t("iot.devices.status.revoked")}
            </NavTabsTrigger>
          </NavTabsList>
        </NavTabs>
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
        <div className="rounded-lg border border-dashed border-[#CDD5DB] p-10 text-center text-sm text-[#68737B]">
          <p className="font-medium text-[#011111]">{t("iot.devices.zeroResults.title")}</p>
          <p className="mt-1">{t("iot.devices.zeroResults.description")}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
            {t("iot.devices.zeroResults.clear")}
          </Button>
        </div>
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
