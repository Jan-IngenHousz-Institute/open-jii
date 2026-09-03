"use client";

import { ConnectivityDot } from "@/components/iot-devices/device-connectivity";
import { DeviceIdentity } from "@/components/iot-devices/device-row";
import { IotDeviceStatusBadge } from "@/components/iot-devices/iot-device-status-badge";
import { useLocale } from "@/hooks/useLocale";
import { formatDate, formatRelativeTime } from "@/util/date";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Lock, X } from "lucide-react";

import type {
  ExperimentDeviceEntry,
  ExperimentDeviceIdentity,
  ExperimentDevicesOverview,
} from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

interface ExperimentDevicesTableProps {
  overview: ExperimentDevicesOverview;
  onRequestDetach: (device: ExperimentDeviceIdentity) => void;
}

/**
 * Every device on the experiment, one row each: identity, live state, what it
 * sent into this experiment in the window, and whether it is onboarded. Only
 * viewable devices link out; the rest still show their facts.
 */
export function ExperimentDevicesTable({ overview, onRequestDetach }: ExperimentDevicesTableProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  function renderRecentData(entry: ExperimentDeviceEntry) {
    if (overview.pipelineUnavailable && entry.recentData === null) {
      return t("iot.experimentDevices.lastDataUnavailable");
    }
    if (entry.recentData === null) {
      return t("iot.experimentDevices.noRecentData");
    }
    return (
      <div className="flex flex-col gap-0.5">
        <span>
          {t("iot.experimentDevices.measurements", { count: entry.recentData.measurementCount })}
        </span>
        {entry.recentData.lastDataAt !== null && (
          <span className="text-muted-foreground text-[11px]">
            {formatRelativeTime(entry.recentData.lastDataAt, locale)}
          </span>
        )}
      </div>
    );
  }

  function renderIdentity(entry: ExperimentDeviceEntry) {
    if (entry.device === null) {
      return (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {t("iot.experimentDevices.unregistered")}
          </span>
          <span className="text-muted-foreground truncate font-mono text-xs">{entry.clientId}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <DeviceIdentity
          device={entry.device}
          href={entry.canView ? `/${locale}/platform/devices/${entry.device.id}` : undefined}
          showSerial
        />
        {!entry.canView && (
          <span
            className="text-muted-foreground shrink-0"
            role="img"
            aria-label={t("iot.experimentDevices.noAccess")}
            title={t("iot.experimentDevices.noAccess")}
          >
            <Lock className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
    );
  }

  function renderRow(entry: ExperimentDeviceEntry) {
    const device = entry.device;
    return (
      <TableRow key={entry.clientId} className="bg-background hover:bg-muted/50 border-border">
        <TableCell className="min-w-0 px-6 py-3">{renderIdentity(entry)}</TableCell>
        <TableCell className="text-muted-foreground px-6 py-3 text-[13px]">
          {device === null ? null : getSensorFamilyLabel(device.deviceType)}
        </TableCell>
        <TableCell className="px-6 py-3">
          <div className="flex flex-col gap-1">
            {device !== null && <IotDeviceStatusBadge status={device.status} />}
            {device !== null && <ConnectivityDot connectivity={entry.connectivity} />}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground px-6 py-3 text-[13px]">
          {renderRecentData(entry)}
        </TableCell>
        <TableCell className="text-muted-foreground px-6 py-3 text-[13px] tabular-nums">
          {entry.binding === null
            ? t("iot.experimentDevices.notOnboarded")
            : formatDate(entry.binding.addedAt)}
        </TableCell>
        <TableCell className="w-12 px-3 py-3 text-right">
          {entry.binding !== null && device !== null && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("iot.experimentDevices.detach")}
              title={t("iot.experimentDevices.detach")}
              onClick={() => {
                onRequestDetach(device);
              }}
            >
              <X className="size-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted border-border hover:bg-transparent">
            <ColumnHead>{t("iot.experimentDevices.columns.device")}</ColumnHead>
            <ColumnHead>{t("iot.devices.columns.type")}</ColumnHead>
            <ColumnHead>{t("iot.experimentDevices.columns.state")}</ColumnHead>
            <ColumnHead>{t("iot.experimentDevices.columns.lastData")}</ColumnHead>
            <ColumnHead>{t("iot.experimentDevices.columns.onboarded")}</ColumnHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>{overview.devices.map(renderRow)}</TableBody>
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
