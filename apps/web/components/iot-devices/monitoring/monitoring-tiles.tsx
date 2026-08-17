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

import type { MonitoringRange } from "./monitoring-range";

// Beyond this silence, a connected device's tile turns amber: online but not
// delivering. A fixed threshold until cadence inference exists.
const SILENT_THRESHOLD_MS = 3_600_000;

interface MonitoringTilesProps {
  device: IotDeviceDetail | undefined;
  activity: IotDeviceActivity | undefined;
  monitoring: DeviceMonitoring | undefined;
  range: MonitoringRange;
}

/** The triage row: live state, then the window's headline figures. */
export function MonitoringTiles({ device, activity, monitoring, range }: MonitoringTilesProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const formatLastSeen = useFormatLastSeen();

  // `undefined` is "still loading" and must not be read as "never sent data",
  // which would flash the silent warning on every page load.
  const lastDataAt = activity === undefined ? undefined : activity.lastDataAt;
  // A failed lookup means unknown, not silent: no warning on an outage.
  const activityKnown = activity !== undefined && !activity.pipelineUnavailable;
  const connectedButSilent =
    device?.connectivity?.connected === true &&
    activityKnown &&
    lastDataAt !== undefined &&
    (lastDataAt === null || Date.now() - new Date(lastDataAt).getTime() > SILENT_THRESHOLD_MS);

  const total = monitoring?.throughput.reduce((sum, bucket) => sum + bucket.count, 0);
  // Fractional hours: truncating would misstate the rate on sub-day windows.
  const windowMs = new Date(range.to).getTime() - new Date(range.from).getTime();
  const windowHours = Math.max(1, windowMs / 3_600_000);
  const perHour = total === undefined ? undefined : total / windowHours;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label={t("iot.devices.monitoring.state")}>
        {device === undefined ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <div className="space-y-1">
            <ConnectivityDot connectivity={device.connectivity} className="text-lg font-semibold" />
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
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-semibold">
              {activity.pipelineUnavailable
                ? t("iot.devices.monitoring.lastDataUnavailable")
                : activity.lastDataAt === null
                  ? t("iot.devices.monitoring.noData")
                  : formatRelativeTime(activity.lastDataAt, locale)}
            </p>
            <p className="text-muted-foreground text-xs font-normal">
              {t("iot.devices.monitoring.pipelineNote")}
            </p>
          </div>
        )}
      </Tile>

      <Tile label={t("iot.devices.monitoring.measurements")}>
        {total === undefined || perHour === undefined ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-semibold tabular-nums">{total}</p>
            <p className="text-muted-foreground text-xs font-normal tabular-nums">
              {t("iot.devices.monitoring.perHour", { rate: perHour.toFixed(1) })}
            </p>
          </div>
        )}
      </Tile>

      <Tile label={t("iot.devices.monitoring.uptimeLabel")}>
        {monitoring === undefined ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-semibold tabular-nums">
              {monitoring.uptimePercent === null
                ? t("iot.devices.monitoring.uptimeUnknown")
                : `${monitoring.uptimePercent.toFixed(1)}%`}
            </p>
            <p className="text-muted-foreground text-xs font-normal">
              {t("iot.devices.monitoring.sessionCount", { count: monitoring.sessions.length })}
            </p>
          </div>
        )}
      </Tile>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1.5 text-sm font-medium">{children}</div>
    </div>
  );
}
