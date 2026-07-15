"use client";

import type { IotDevice } from "@repo/api/domains/iot/iot.schema";
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

import { IotDeviceTableRow } from "./iot-device-table-row";
import { LIST_HEADER_BG, LIST_TABLE_BORDER, LIST_TEXT_MUTED } from "./iot-devices-list-tokens";

interface IotDevicesTableProps {
  devices: IotDevice[];
  isLoading?: boolean;
}

export function IotDevicesTable({ devices, isLoading }: IotDevicesTableProps) {
  const { t } = useTranslation("iot");

  return (
    <div className={cn("overflow-hidden rounded-lg border", LIST_TABLE_BORDER)}>
      <Table>
        <TableHeader>
          <TableRow className={cn("hover:bg-transparent", LIST_HEADER_BG, LIST_TABLE_BORDER)}>
            <ColumnHead>{t("iot.devices.columns.name")}</ColumnHead>
            <ColumnHead>{t("iot.devices.columns.status")}</ColumnHead>
            <ColumnHead>{t("iot.devices.columns.type")}</ColumnHead>
            <ColumnHead>{t("iot.devices.columns.serial")}</ColumnHead>
            <ColumnHead>{t("iot.devices.columns.created")}</ColumnHead>
            <TableHead aria-hidden className="w-12" />
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

function ColumnHead({ children }: { children: React.ReactNode }) {
  return (
    <TableHead
      className={cn(
        "h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]",
        LIST_TEXT_MUTED,
      )}
    >
      {children}
    </TableHead>
  );
}

function SkeletonRow() {
  return (
    <TableRow className={cn("hover:bg-transparent", LIST_TABLE_BORDER)}>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-4 w-40" />
      </TableCell>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="w-12 px-6 py-3" />
    </TableRow>
  );
}
