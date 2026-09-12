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

import { MetricStatCard } from "../../metrics/metric-stat-card";
import { metricsBandGrid } from "../../metrics/metrics-band-grid";
import type { MonitoringRange } from "./monitoring-range";
import { SILENT_THRESHOLD_MS } from "./silent-threshold";

interface MonitoringTilesProps {
  /** Extra classes per tile, e.g. a translucent ground on the wash hero. */
  tileClassName?: string;
  device: IotDeviceDetail | undefined;
  activity: IotDeviceActivity | undefined;
  monitoring: DeviceMonitoring | undefined;
  range: MonitoringRange;
}

/** The triage row: live state, then the window's headline figures. */
export function MonitoringTiles({
  device,
  activity,
  monitoring,
  range,
  tileClassName,
}: MonitoringTilesProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const formatLastSeen = useFormatLastSeen();

  // Phones connect only while the app is foregrounded; gaps and silence are
  // normal life, not degradation, so neither verdict applies to them.
  const isMobileFamily = device?.deviceType === "mobile";

  // `undefined` is "still loading" and must not be read as "never sent data",
  // which would flash the silent warning on every page load.
  const lastDataAt = activity === undefined ? undefined : activity.lastDataAt;
  // A failed lookup means unknown, not silent: no warning on an outage.
  const activityKnown = activity !== undefined && !activity.pipelineUnavailable;
  const connectedButSilent =
    !isMobileFamily &&
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
    <div className={metricsBandGrid}>
      <MetricStatCard
        locale={locale}
        label={t("iot.devices.monitoring.state")}
        value={
          device === undefined ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            // ConnectivityDot carries its own text-xs, which beats the
            // CardTitle's text-2xl from the child element.
            <ConnectivityDot
              connectivity={device.connectivity}
              className="text-2xl font-semibold"
            />
          )
        }
        note={device === undefined ? undefined : formatLastSeen(device.connectivity)}
        alert={
          connectedButSilent ? (
            <>
              <AlertTriangle className="h-3 w-3" />
              {t("iot.devices.monitoring.connectedButSilent")}
            </>
          ) : undefined
        }
        className={tileClassName}
      />

      <MetricStatCard
        locale={locale}
        label={t("iot.devices.monitoring.lastData")}
        value={
          activity === undefined ? (
            <Skeleton className="h-7 w-24" />
          ) : activity.pipelineUnavailable ? (
            t("iot.devices.monitoring.lastDataUnavailable")
          ) : activity.lastDataAt === null ? (
            t("iot.devices.monitoring.noData")
          ) : (
            formatRelativeTime(activity.lastDataAt, locale)
          )
        }
        context={activity === undefined ? undefined : t("iot.devices.monitoring.pipelineNote")}
        className={tileClassName}
      />

      <MetricStatCard
        locale={locale}
        label={t("iot.devices.monitoring.measurements")}
        value={
          total === undefined ? <Skeleton className="h-7 w-16" /> : total.toLocaleString(locale)
        }
        title={total === undefined ? undefined : total.toLocaleString(locale)}
        note={
          perHour === undefined
            ? undefined
            : t("iot.devices.monitoring.perHour", {
                rate: perHour.toLocaleString(locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              })
        }
        className={tileClassName}
      />

      <MetricStatCard
        locale={locale}
        label={
          isMobileFamily
            ? t("iot.devices.monitoring.sessionsLabel")
            : t("iot.devices.monitoring.uptimeLabel")
        }
        value={
          monitoring === undefined ? (
            <Skeleton className="h-7 w-16" />
          ) : isMobileFamily ? (
            monitoring.sessions.length.toLocaleString(locale)
          ) : monitoring.uptimePercent === null ? (
            t("iot.devices.monitoring.uptimeUnknown")
          ) : (
            `${monitoring.uptimePercent.toFixed(1)}%`
          )
        }
        note={
          monitoring === undefined
            ? undefined
            : isMobileFamily
              ? t("iot.devices.monitoring.mobileSessionsNote")
              : t("iot.devices.monitoring.sessionCount", { count: monitoring.sessions.length })
        }
        className={tileClassName}
      />
    </div>
  );
}
