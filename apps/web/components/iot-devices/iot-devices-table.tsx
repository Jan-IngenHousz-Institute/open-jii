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

import { IotDeviceTableRow } from "./iot-device-table-row";

interface IotDevicesTableProps {
  devices: IotDeviceWithConnectivity[];
  isLoading?: boolean;
}

export function IotDevicesTable({ devices, isLoading }: IotDevicesTableProps) {
  const { t } = useTranslation("iot");

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-surface-light border-border hover:bg-transparent">
            <ColumnHead>{t("iot.devices.columns.name")}</ColumnHead>
            <ColumnHead>{t("iot.devices.columns.status")}</ColumnHead>
            <ColumnHead>{t("iot.devices.columns.type")}</ColumnHead>
            <ColumnHead>{t("iot.devices.columns.serial")}</ColumnHead>
            <ColumnHead>{t("iot.devices.columns.lastSeen")}</ColumnHead>
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
    <TableHead className="text-muted-foreground h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]">
      {children}
    </TableHead>
  );
}

function SkeletonRow() {
  return (
    <TableRow className="border-border hover:bg-transparent">
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
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="w-12 px-6 py-3" />
    </TableRow>
  );
}
