"use client";

import { ConnectivityDot } from "@/components/iot-devices/device-connectivity";
import { DeviceIdentity } from "@/components/iot-devices/device-row";
import { IotDeviceStatusBadge } from "@/components/iot-devices/iot-device-status-badge";
import { Lock } from "lucide-react";
import { useState } from "react";

import type { ExperimentDeviceEntry } from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import { useTranslation } from "@repo/i18n";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { SearchInput } from "@repo/ui/components/search-input";
import { cn } from "@repo/ui/lib/utils";

/** Matches the device registry's page size, so both device lists page alike. */
const PAGE_SIZE = 25;

interface ExperimentDevicesListProps {
  devices: ExperimentDeviceEntry[];
  selectedClientId: string | null;
  onSelect: (clientId: string) => void;
}

/** Rows compose `DeviceIdentity`: `DeviceRow`'s `selection` prop is multi-select grammar. */
export function ExperimentDevicesList({
  devices,
  selectedClientId,
  onSelect,
}: ExperimentDevicesListProps) {
  const { t } = useTranslation("iot");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = search.trim().toLowerCase();
  const matching =
    query === ""
      ? devices
      : devices.filter((entry) => {
          const haystack = [entry.clientId, entry.device?.name, entry.device?.serialNumber];
          return haystack.some((value) => value?.toLowerCase().includes(query));
        });

  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

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

          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {entry.device !== null && <IotDeviceStatusBadge status={entry.device.status} />}
            {entry.device !== null && <ConnectivityDot connectivity={entry.connectivity} />}
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
      <div className="p-3">
        <SearchInput
          value={search}
          onChange={changeSearch}
          placeholder={t("iot.experimentDevices.searchPlaceholder")}
          className="w-full"
        />
      </div>

      {matching.length === 0 ? (
        <p className="text-muted-foreground border-border border-t px-3 py-6 text-center text-sm">
          {t("iot.experimentDevices.searchNoMatches")}
        </p>
      ) : (
        <ScrollArea className="border-border max-h-128 overflow-y-auto border-t">
          <ul className="divide-border min-w-0 divide-y">{pageRows.map(renderRow)}</ul>
        </ScrollArea>
      )}

      {totalPages > 1 && (
        <div className="border-border flex items-center justify-between border-t px-3 py-2">
          <span className="text-muted-foreground text-xs">
            {t("iot.devices.pageOf", { page: currentPage, total: totalPages })}
          </span>
          <Pagination className="m-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  size="sm"
                  onClick={() => {
                    setPage(Math.max(1, currentPage - 1));
                  }}
                  aria-disabled={currentPage <= 1}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  size="sm"
                  onClick={() => {
                    setPage(Math.min(totalPages, currentPage + 1));
                  }}
                  aria-disabled={currentPage >= totalPages}
                  className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
