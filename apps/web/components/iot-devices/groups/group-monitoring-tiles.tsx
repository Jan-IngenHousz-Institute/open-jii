"use client";

import { formatRelativeTime } from "@/util/date";
import { AlertTriangle } from "lucide-react";

import type { DeviceGroupMonitoring } from "@repo/api/domains/device-group/device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

import type { MonitoringRange } from "../monitoring/monitoring-range";
import { summarizeGroupHealth } from "./group-health";

interface GroupMonitoringTilesProps {
  monitoring: DeviceGroupMonitoring | undefined;
  range: MonitoringRange;
  locale: string;
  now: number;
}

/** The triage row: who is on right now, how fresh the data is, and the window's volume. */
export function GroupMonitoringTiles({
  monitoring,
  range,
  locale,
  now,
}: GroupMonitoringTilesProps) {
  const { t } = useTranslation("iot");

  const summary =
    monitoring === undefined
      ? undefined
      : summarizeGroupHealth(monitoring.members, monitoring.pipelineUnavailable, now);

  const freshest = monitoring?.members.reduce<string | null>(
    (latest, member) =>
      member.lastDataAt !== null && (latest === null || member.lastDataAt > latest)
        ? member.lastDataAt
        : latest,
    null,
  );

  const total = monitoring?.throughput.reduce((sum, bucket) => sum + bucket.count, 0);
  // Fractional hours: truncating would misstate the rate on sub-day windows.
  const windowMs = new Date(range.to).getTime() - new Date(range.from).getTime();
  const windowHours = Math.max(1, windowMs / 3_600_000);
  const perHour = total === undefined ? undefined : total / windowHours;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label={t("iot.groups.monitoring.onlineLabel")}>
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

      <Tile label={t("iot.devices.monitoring.lastData")}>
        {monitoring === undefined ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <p className="text-lg font-semibold">
            {monitoring.pipelineUnavailable
              ? t("iot.devices.monitoring.lastDataUnavailable")
              : freshest == null
                ? t("iot.groups.monitoring.noData")
                : formatRelativeTime(freshest, locale)}
          </p>
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

      <Tile label={t("iot.groups.monitoring.unknownLabel")}>
        {summary === undefined ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <p className="text-lg font-semibold tabular-nums">{summary.unknown}</p>
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
