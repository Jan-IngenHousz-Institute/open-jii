"use client";

import type { IotDevice } from "@repo/api/schemas/iot.schema";
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

interface IotDevicesListProps {
  devices: IotDevice[];
  isLoading?: boolean;
}

export function IotDevicesList({ devices, isLoading }: IotDevicesListProps) {
  const { t } = useTranslation("iot");

  if (!isLoading && devices.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
        {t("devices.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("devices.columns.name")}</TableHead>
            <TableHead>{t("devices.columns.serial")}</TableHead>
            <TableHead>{t("devices.columns.type")}</TableHead>
            <TableHead>{t("devices.columns.status")}</TableHead>
            <TableHead>{t("devices.columns.created")}</TableHead>
            <TableHead aria-hidden className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            : devices.map((device) => <IotDeviceTableRow key={device.id} device={device} />)}
        </TableBody>
      </Table>
    </div>
  );
}
