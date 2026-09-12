"use client";

import { formatRelativeTime } from "@/util/date";
import { AlertTriangle } from "lucide-react";

import type {
  IotDeviceGroupMemberHealth,
  IotDeviceGroupMonitoring,
  IotDeviceGroupThroughputBucket,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

import { MetricStatCard } from "../../metrics/metric-stat-card";
import { metricsBandGrid } from "../../metrics/metrics-band-grid";
import type { MonitoringRange } from "../monitoring/monitoring-range";
import { summarizeGroupHealth } from "./group-health";

interface GroupMonitoringTilesProps {
  /** Extra classes per tile, e.g. a translucent ground on the wash hero. */
  tileClassName?: string;
  monitoring: IotDeviceGroupMonitoring | undefined;
  /** The filtered member subset the whole dashboard is scoped to. */
  members: IotDeviceGroupMemberHealth[];
  throughput: IotDeviceGroupThroughputBucket[];
  range: MonitoringRange;
  locale: string;
  now: number;
}

/** The triage row: who is on right now, how fresh the data is, and the window's volume. */
export function GroupMonitoringTiles({
  monitoring,
  members,
  throughput,
  range,
  locale,
  now,
  tileClassName,
}: GroupMonitoringTilesProps) {
  const { t } = useTranslation("iot");

  const summary =
    monitoring === undefined
      ? undefined
      : summarizeGroupHealth(members, monitoring.pipelineUnavailable, now);

  const freshest = members.reduce<string | null>(
    (latest, member) =>
      member.lastDataAt !== null && (latest === null || member.lastDataAt > latest)
        ? member.lastDataAt
        : latest,
    null,
  );

  const total =
    monitoring === undefined
      ? undefined
      : throughput.reduce((sum, bucket) => sum + bucket.count, 0);
  // Fractional hours: truncating would misstate the rate on sub-day windows.
  const windowMs = new Date(range.to).getTime() - new Date(range.from).getTime();
  const windowHours = Math.max(1, windowMs / 3_600_000);
  const perHour = total === undefined ? undefined : total / windowHours;

  return (
    <div className={metricsBandGrid}>
      <MetricStatCard
        locale={locale}
        label={t("iot.groups.monitoring.onlineLabel")}
        value={
          summary === undefined ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            t("iot.groups.monitoring.onlineValue", {
              online: summary.online,
              total: summary.total,
            })
          )
        }
        alert={
          summary !== undefined && summary.silent > 0 ? (
            <>
              <AlertTriangle className="h-3 w-3" />
              {t("iot.groups.monitoring.silentCount", { count: summary.silent })}
            </>
          ) : undefined
        }
        className={tileClassName}
      />

      <MetricStatCard
        locale={locale}
        label={t("iot.devices.monitoring.lastData")}
        value={
          monitoring === undefined ? (
            <Skeleton className="h-7 w-24" />
          ) : monitoring.pipelineUnavailable ? (
            t("iot.devices.monitoring.lastDataUnavailable")
          ) : freshest === null ? (
            t("iot.groups.monitoring.noData")
          ) : (
            formatRelativeTime(freshest, locale)
          )
        }
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
        label={t("iot.groups.monitoring.unknownLabel")}
        value={
          summary === undefined ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            summary.unknown.toLocaleString(locale)
          )
        }
        className={tileClassName}
      />
    </div>
  );
}
