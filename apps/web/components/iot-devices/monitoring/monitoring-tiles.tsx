"use client";

import { ConnectivityDot, useFormatLastSeen } from "@/components/iot-devices/device-connectivity";
import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { AlertTriangle } from "lucide-react";

import type {
  DeviceMonitoring,
  IotDeviceActivity,
  IotDeviceDetail,
} from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

// Beyond this silence, a connected device's tile turns amber: online but not
// delivering. A fixed threshold until cadence inference exists.
const SILENT_THRESHOLD_MS = 3_600_000;

interface MonitoringTilesProps {
  device: IotDeviceDetail | undefined;
  activity: IotDeviceActivity | undefined;
  monitoring: DeviceMonitoring | undefined;
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}

/** The triage row: live state first, then recency, volume, and battery. */
export function MonitoringTiles({ device, activity, monitoring }: MonitoringTilesProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const formatLastSeen = useFormatLastSeen();

  const lastDataAt = activity?.lastDataAt ?? null;
  const connectedButSilent =
    device?.connectivity?.connected === true &&
    (lastDataAt === null || Date.now() - new Date(lastDataAt).getTime() > SILENT_THRESHOLD_MS);

  const totalMeasurements = monitoring?.throughput.reduce((sum, bucket) => sum + bucket.count, 0);
  const latestBattery = monitoring?.battery.filter((point) => point.averageBattery !== null).at(-1);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label={t("iot.devices.monitoring.state")}>
        {device === undefined ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <div className="space-y-1">
            <ConnectivityDot connectivity={device.connectivity} />
            <p className="text-muted-foreground text-xs font-normal">
              {formatLastSeen(device.connectivity)}
            </p>
            {connectedButSilent && (
              <p className="flex items-center gap-1 text-xs font-normal text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                {t("iot.devices.monitoring.connectedButSilent")}
              </p>
            )}
          </div>
        )}
      </Tile>

      <Tile label={t("iot.devices.monitoring.lastData")}>
        {activity === undefined ? (
          <Skeleton className="h-4 w-24" />
        ) : lastDataAt === null ? (
          t("iot.devices.monitoring.noData")
        ) : (
          formatRelativeTime(lastDataAt, locale)
        )}
      </Tile>

      <Tile label={t("iot.devices.monitoring.measurements")}>
        {totalMeasurements === undefined ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="tabular-nums">{totalMeasurements}</span>
        )}
      </Tile>

      <Tile label={t("iot.devices.monitoring.batteryAxis")}>
        {monitoring === undefined ? (
          <Skeleton className="h-4 w-16" />
        ) : latestBattery?.averageBattery == null ? (
          t("iot.devices.monitoring.noBattery")
        ) : (
          <span className="tabular-nums">{`${latestBattery.averageBattery.toFixed(0)}%`}</span>
        )}
      </Tile>
    </div>
  );
}
