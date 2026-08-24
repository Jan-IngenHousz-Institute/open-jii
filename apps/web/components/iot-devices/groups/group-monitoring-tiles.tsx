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

import type { MonitoringRange } from "../monitoring/monitoring-range";
import { Tile } from "../monitoring/tile";
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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile className={tileClassName} label={t("iot.groups.monitoring.onlineLabel")}>
        {summary === undefined ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-semibold">
              {t("iot.groups.monitoring.onlineValue", {
                online: summary.online,
                total: summary.total,
              })}
            </p>
            {summary.silent > 0 && (
              <p className="flex items-center gap-1 text-xs font-normal text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                {t("iot.groups.monitoring.silentCount", { count: summary.silent })}
              </p>
            )}
          </div>
        )}
      </Tile>

      <Tile className={tileClassName} label={t("iot.devices.monitoring.lastData")}>
        {monitoring === undefined ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <p className="text-lg font-semibold">
            {monitoring.pipelineUnavailable
              ? t("iot.devices.monitoring.lastDataUnavailable")
              : freshest === null
                ? t("iot.groups.monitoring.noData")
                : formatRelativeTime(freshest, locale)}
          </p>
        )}
      </Tile>

      <Tile className={tileClassName} label={t("iot.devices.monitoring.measurements")}>
        {total === undefined || perHour === undefined ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-semibold tabular-nums">{total.toLocaleString(locale)}</p>
            <p className="text-muted-foreground text-xs font-normal tabular-nums">
              {t("iot.devices.monitoring.perHour", {
                rate: perHour.toLocaleString(locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              })}
            </p>
          </div>
        )}
      </Tile>

      <Tile className={tileClassName} label={t("iot.groups.monitoring.unknownLabel")}>
        {summary === undefined ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <p className="text-lg font-semibold tabular-nums">{summary.unknown}</p>
        )}
      </Tile>
    </div>
  );
}
