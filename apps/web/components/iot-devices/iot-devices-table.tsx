"use client";

import type { IotDeviceWithConnectivity } from "@repo/api/domains/iot/iot.schema";
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
}

export function IotDevicesTable({ devices, isLoading }: IotDevicesTableProps) {
  const { t } = useTranslation("iot");

  return (
    <div className="border-border overflow-hidden rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/50 border-border hover:bg-transparent">
            <ColumnHead className={IOT_DEVICE_TABLE_COLUMN_CLASS.name}>
              {t("iot.devices.columns.name")}
            </ColumnHead>
            <ColumnHead className={IOT_DEVICE_TABLE_COLUMN_CLASS.status}>
              {t("iot.devices.columns.status")}
            </ColumnHead>
            <ColumnHead className={IOT_DEVICE_TABLE_COLUMN_CLASS.type}>
              {t("iot.devices.columns.type")}
            </ColumnHead>
            <ColumnHead className={IOT_DEVICE_TABLE_COLUMN_CLASS.serial}>
              {t("iot.devices.columns.serial")}
            </ColumnHead>
            <ColumnHead className={IOT_DEVICE_TABLE_COLUMN_CLASS.lastSeen}>
              {t("iot.devices.columns.lastSeen")}
            </ColumnHead>
            <ColumnHead className={IOT_DEVICE_TABLE_COLUMN_CLASS.created}>
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

function ColumnHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableHead
      className={cn(
        "text-muted-foreground h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]",
        className,
      )}
    >
      {children}
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
