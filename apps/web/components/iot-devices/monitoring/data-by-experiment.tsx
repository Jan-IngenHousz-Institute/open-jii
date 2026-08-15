"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import type { DeviceExperiment, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { HorizontalBarChart } from "@repo/ui/components/charts/bar-chart";

import { MONITORING_PRIMARY_COLOR } from "./monitoring-palette";

interface DataByExperimentProps {
  monitoring: DeviceMonitoring;
  boundExperiments: DeviceExperiment[];
}

interface ExperimentRow {
  id: string;
  name: string;
  count: number;
  lastBucketAt: string | null;
  bound: boolean;
}

/**
 * Where this device's data landed, at the per-experiment grain: volume as a
 * chart for comparison, and a row per experiment for recency, flags and the
 * link to the measurements themselves.
 */
export function DataByExperiment({ monitoring, boundExperiments }: DataByExperimentProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const rows = buildRows(monitoring, boundExperiments);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.devices.monitoring.noExperiments")}
      </p>
    );
  }

  const charted = rows.filter((row) => row.count > 0);

  return (
    <div className="space-y-4">
      {charted.length > 0 && (
        <div
          className="w-full"
          style={{ height: `${String(Math.max(120, charted.length * 44))}px` }}
        >
          <HorizontalBarChart
            data={[
              {
                name: t("iot.devices.monitoring.measurements"),
                x: charted.map((row) => row.count),
                y: charted.map((row) => row.name),
                color: MONITORING_PRIMARY_COLOR,
              },
            ]}
            config={{
              showLegend: false,
              showModeBar: false,
              xAxisType: "linear",
              yAxisType: "category",
            }}
          />
        </div>
      )}

      <ul className="divide-y rounded-lg border">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <Link
                href={`/${locale}/platform/experiments/${row.id}/data`}
                className="inline-flex items-center gap-1 font-medium hover:underline"
              >
                {row.name}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
              {row.count === 0 && row.bound && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  {t("iot.devices.monitoring.boundButSilent")}
                </span>
              )}
              {!row.bound && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {t("iot.devices.monitoring.notBound")}
                </span>
              )}
            </div>
            <span className="text-muted-foreground text-xs">
              {row.lastBucketAt === null
                ? t("iot.devices.monitoring.noData")
                : formatRelativeTime(row.lastBucketAt, locale)}
            </span>
            <span className="w-16 text-right tabular-nums">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildRows(
  monitoring: DeviceMonitoring,
  boundExperiments: DeviceExperiment[],
): ExperimentRow[] {
  const totals = new Map<string, { count: number; lastBucketAt: string | null }>();
  for (const bucket of monitoring.throughput) {
    if (bucket.experimentId === null) {
      continue;
    }
    const entry = totals.get(bucket.experimentId) ?? { count: 0, lastBucketAt: null };
    entry.count += bucket.count;
    if (entry.lastBucketAt === null || bucket.bucketStart > entry.lastBucketAt) {
      entry.lastBucketAt = bucket.bucketStart;
    }
    totals.set(bucket.experimentId, entry);
  }

  const bound: ExperimentRow[] = boundExperiments.map((experiment) => ({
    id: experiment.id,
    name: experiment.name,
    count: totals.get(experiment.id)?.count ?? 0,
    lastBucketAt: totals.get(experiment.id)?.lastBucketAt ?? null,
    bound: true,
  }));

  // Data arriving for experiments the device is no longer bound to still shows:
  // hiding it would hide a misconfiguration.
  const unbound: ExperimentRow[] = [...totals.entries()]
    .filter(([experimentId]) => !boundExperiments.some((bound) => bound.id === experimentId))
    .map(([experimentId, entry]) => ({
      id: experimentId,
      name: experimentId,
      count: entry.count,
      lastBucketAt: entry.lastBucketAt,
      bound: false,
    }));

  return [...bound, ...unbound].sort((a, b) => b.count - a.count);
}
