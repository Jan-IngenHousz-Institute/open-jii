"use client";

import type { OverviewTableSorting } from "@/components/overview-table/overview-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import type { IotDeviceSort, IotDeviceWithConnectivity } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

import { IOT_DEVICE_TABLE_COLUMN_CLASS } from "./iot-device-table-columns";
import { IotDeviceTableRow } from "./iot-device-table-row";

interface IotDevicesTableProps {
  devices: IotDeviceWithConnectivity[];
  isLoading?: boolean;
  sorting?: OverviewTableSorting<IotDeviceSort[number]["field"]>;
}

export function IotDevicesTable({ devices, isLoading, sorting }: IotDevicesTableProps) {
  const { t } = useTranslation("iot");

  return (
    <div className="border-border overflow-hidden rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/50 border-border hover:bg-transparent">
            <ColumnHead
              className={IOT_DEVICE_TABLE_COLUMN_CLASS.name}
              field="name"
              sorting={sorting}
            >
              {t("iot.devices.columns.name")}
            </ColumnHead>
            <ColumnHead
              className={IOT_DEVICE_TABLE_COLUMN_CLASS.status}
              field="status"
              sorting={sorting}
            >
              {t("iot.devices.columns.status")}
            </ColumnHead>
            <ColumnHead
              className={IOT_DEVICE_TABLE_COLUMN_CLASS.type}
              field="family"
              sorting={sorting}
            >
              {t("iot.devices.columns.family")}
            </ColumnHead>
            <ColumnHead className={IOT_DEVICE_TABLE_COLUMN_CLASS.serial}>
              {t("iot.devices.columns.serial")}
            </ColumnHead>
            <ColumnHead className={IOT_DEVICE_TABLE_COLUMN_CLASS.lastSeen}>
              {t("iot.devices.columns.lastSeen")}
            </ColumnHead>
            <ColumnHead
              className={IOT_DEVICE_TABLE_COLUMN_CLASS.created}
              field="registered"
              sorting={sorting}
            >
              {t("iot.devices.columns.created")}
            </ColumnHead>
            <TableHead aria-hidden className={IOT_DEVICE_TABLE_COLUMN_CLASS.actions} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => <SkeletonRow key={index} />)
            : devices.map((device) => <IotDeviceTableRow key={device.id} device={device} />)}
        </TableBody>
      </Table>
    </div>
  );
}

function ColumnHead({
  children,
  className,
  field,
  sorting,
}: {
  children: string;
  className?: string;
  field?: IotDeviceSort[number]["field"];
  sorting?: IotDevicesTableProps["sorting"];
}) {
  const { t } = useTranslation("common");
  const index = sorting?.sort.findIndex((item) => item.field === field) ?? -1;
  const direction = sorting?.sort[index]?.direction;
  const label =
    direction === "asc"
      ? t("common.sortAscending")
      : direction === "desc"
        ? t("common.sortDescending")
        : t("common.sortUnsorted");
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <TableHead
      aria-sort={index === 0 ? (direction === "asc" ? "ascending" : "descending") : undefined}
      className={cn(
        "text-muted-foreground h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]",
        className,
      )}
    >
      {sorting && field ? (
        <button
          type="button"
          className="hover:text-foreground inline-flex items-center gap-1 text-left uppercase focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={`${children}: ${label}${index > 0 ? `, ${t("common.sortSecondary")}` : ""}`}
          onClick={(event) => sorting.onToggle(field, event.shiftKey)}
        >
          {children}
          <Icon
            aria-hidden
            className={cn("size-3.5", direction ? "text-status-active-foreground" : "opacity-50")}
          />
          {index > 0 && <span aria-hidden>2</span>}
        </button>
      ) : (
        children
      )}
    </TableHead>
  );
}

function SkeletonRow() {
  return (
    <TableRow className="border-border hover:bg-transparent">
      <TableCell
        className={cn("min-w-0 overflow-hidden px-6 py-3", IOT_DEVICE_TABLE_COLUMN_CLASS.name)}
      >
        <Skeleton className="h-4 w-40" />
      </TableCell>
      <TableCell className={cn("px-6 py-3", IOT_DEVICE_TABLE_COLUMN_CLASS.status)}>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell className={cn("px-6 py-3", IOT_DEVICE_TABLE_COLUMN_CLASS.type)}>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className={cn("px-6 py-3", IOT_DEVICE_TABLE_COLUMN_CLASS.serial)}>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell className={cn("px-6 py-3", IOT_DEVICE_TABLE_COLUMN_CLASS.lastSeen)}>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell className={cn("px-6 py-3", IOT_DEVICE_TABLE_COLUMN_CLASS.created)}>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className={cn("px-6 py-3", IOT_DEVICE_TABLE_COLUMN_CLASS.actions)} />
    </TableRow>
  );
}
