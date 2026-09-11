"use client";

import { ConnectivityDot } from "@/components/iot-devices/device-connectivity";
import { IotDeviceStatusBadge } from "@/components/iot-devices/iot-device-status-badge";
import { useLocale } from "@/hooks/useLocale";
import { formatDate, formatRelativeTime } from "@/util/date";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { ExternalLink, Lock, Unlink } from "lucide-react";
import Link from "next/link";

import type {
  ExperimentDeviceEntry,
  ExperimentDeviceIdentity,
} from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { ExperimentDeviceSeriesPanel } from "./experiment-device-series-panel";

interface ExperimentDeviceDetailProps {
  experimentId: string;
  /** Never null: the panel guards the empty roster and auto-selects the first row. */
  entry: ExperimentDeviceEntry;
  window: { from: string; to: string };
  pipelineUnavailable: boolean;
  onRequestDetach: (device: ExperimentDeviceIdentity) => void;
}

export function ExperimentDeviceDetail({
  experimentId,
  entry,
  window,
  pipelineUnavailable,
  onRequestDetach,
}: ExperimentDeviceDetailProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const device = entry.device;
  const reported = entry.reported;

  function renderWindowCount() {
    if (pipelineUnavailable && entry.recentData === null) {
      return t("iot.experimentDevices.lastDataUnavailable");
    }
    if (entry.recentData === null) {
      return t("iot.experimentDevices.noRecentData");
    }
    return t("iot.experimentDevices.measurements", {
      count: entry.recentData.measurementCount,
    });
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-medium">
            {device?.name ?? reported?.deviceName ?? t("iot.experimentDevices.unregistered")}
          </h3>
          <p className="text-muted-foreground truncate font-mono text-xs">{entry.clientId}</p>
        </div>

        <div className="flex items-center gap-2">
          {device !== null && <IotDeviceStatusBadge status={device.status} />}
          {device !== null && <ConnectivityDot connectivity={entry.connectivity} />}
          {entry.binding !== null && device !== null && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onRequestDetach(device);
              }}
            >
              <Unlink className="mr-1.5 size-4" aria-hidden />
              {t("iot.experimentDevices.detach")}
            </Button>
          )}
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {device !== null && (
          <Fact label={t("iot.devices.columns.serial")} value={device.serialNumber} mono />
        )}
        {device !== null && (
          <Fact
            label={t("iot.devices.columns.type")}
            value={getSensorFamilyLabel(device.deviceType)}
          />
        )}
        <Fact
          label={t("iot.experimentDevices.facts.firmware")}
          value={
            reported?.version ?? reported?.firmware ?? t("iot.experimentDevices.unknownFirmware")
          }
          mono
        />
        <Fact
          label={t("iot.experimentDevices.columns.battery")}
          value={
            reported?.battery == null
              ? "—"
              : reported.battery.toLocaleString(locale, { maximumFractionDigits: 2 })
          }
        />
        <Fact label={t("iot.experimentDevices.facts.inWindow")} value={renderWindowCount()} />
        <Fact
          label={t("iot.experimentDevices.facts.allTime")}
          value={
            reported === null
              ? "—"
              : t("iot.experimentDevices.measurements", { count: reported.totalMeasurements })
          }
        />
        <Fact
          label={t("iot.experimentDevices.facts.lastDataAnywhere")}
          value={entry.lastDataAt === null ? "—" : formatRelativeTime(entry.lastDataAt, locale)}
        />
        <Fact
          label={t("iot.experimentDevices.columns.onboarded")}
          value={
            entry.binding === null
              ? t("iot.experimentDevices.notOnboarded")
              : formatDate(entry.binding.addedAt)
          }
        />
      </dl>

      {device !== null &&
        (entry.canView ? (
          <Link
            href={`/${locale}/platform/devices/${device.id}/monitoring`}
            className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
          >
            {t("iot.experimentDevices.openMonitoring")}
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <Lock className="size-3.5" aria-hidden />
            {t("iot.experimentDevices.noAccess")}
          </p>
        ))}

      <ExperimentDeviceSeriesPanel
        experimentId={experimentId}
        clientId={entry.clientId}
        window={window}
      />
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={mono === true ? "truncate font-mono text-sm" : "truncate text-sm"}>{value}</dd>
    </div>
  );
}
