"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { AlertTriangle } from "lucide-react";

import type { DeviceExperiment, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { HorizontalBarChart } from "@repo/ui/components/charts/bar-chart";
import { useChartThemeRefresh } from "@repo/ui/components/charts/use-chart-theme-refresh";
import { EmptyState } from "@repo/ui/components/empty-state";

import { EntityLink } from "./entity-link";
import { monitoringPrimaryColor } from "./monitoring-palette";
import type { EntityAccess, ResolvedEntity } from "./resolve-entity-label";
import { resolveEntities } from "./resolve-entity-label";

interface DataByExperimentProps {
  monitoring: DeviceMonitoring;
  boundExperiments: DeviceExperiment[];
  /** Experiments the viewer is a member of; the rest stay unnamed. */
  visibleExperiments: EntityAccess[];
  locale: string;
}

interface ExperimentRow {
  entity: ResolvedEntity;
  count: number;
  lastBucketAt: string | null;
  bound: boolean;
}

/**
 * Where this device's data landed, at the per-experiment grain: volume as a
 * chart for comparison, and a row per experiment for recency, flags and the
 * link to the measurements themselves.
 */
export function DataByExperiment({
  monitoring,
  boundExperiments,
  visibleExperiments,
}: DataByExperimentProps) {
  const { t } = useTranslation("iot");
  // Resolved in JS, so this has to learn about a theme swap itself.
  useChartThemeRefresh();
  const seriesColor = monitoringPrimaryColor();
  const locale = useLocale();

  const rows = buildRows(monitoring, boundExperiments, visibleExperiments, locale, (index) =>
    t("iot.devices.monitoring.privateExperiment", { index }),
  );

  if (rows.length === 0) {
    return <EmptyState size="inline" description={t("iot.devices.monitoring.noExperiments")} />;
  }

  const charted = rows.filter((row) => row.count > 0);

  return (
    <div className="space-y-4">
      {charted.length > 0 && (
        <div
          className="w-full"
          style={{ height: `${String(Math.max(208, charted.length * 44))}px` }}
        >
          <HorizontalBarChart
            data={[
              {
                name: t("iot.devices.monitoring.measurements"),
                x: charted.map((row) => row.count),
                y: charted.map((row) => row.entity.label),
                color: seriesColor,
              },
            ]}
            config={{
              showLegend: false,
              showModeBar: true,
              modeBarStyle: "transparent",
              xAxisType: "linear",
              yAxisType: "category",
            }}
          />
        </div>
      )}

      <ul className="divide-y rounded-lg border">
        {rows.map((row) => (
          <li
            key={row.entity.id}
            className="flex min-w-0 flex-col items-start gap-1.5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-3"
          >
            <div className="w-full min-w-0 sm:flex-1">
              <EntityLink entity={row.entity} />
              {row.count === 0 && row.bound && (
                <span className="text-status-stale-foreground ml-2 inline-flex items-center gap-1 text-xs">
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
            <div
              data-slot="experiment-row-metadata"
              className="flex w-full items-center justify-between gap-3 sm:contents"
            >
              <span className="text-muted-foreground min-w-0 text-xs">
                {row.lastBucketAt === null
                  ? t("iot.devices.monitoring.noData")
                  : formatRelativeTime(row.lastBucketAt, locale)}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums">{row.count}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildRows(
  monitoring: DeviceMonitoring,
  boundExperiments: DeviceExperiment[],
  visibleExperiments: EntityAccess[],
  locale: string,
  privateLabel: (index: number) => string,
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

  // A bound experiment is one the viewer can already see through this device,
  // so its name is known regardless of the viewer's own experiment list.
  const known: EntityAccess[] = [
    ...boundExperiments.map((experiment) => ({ id: experiment.id, name: experiment.name })),
    ...visibleExperiments,
  ];
  const ids = [...boundExperiments.map((experiment) => experiment.id), ...totals.keys()];
  const resolved = resolveEntities(
    ids,
    known,
    (id) => `/${locale}/platform/experiments/${id}/data`,
    privateLabel,
  );

  return [...resolved.values()]
    .map((entity) => ({
      entity,
      count: totals.get(entity.id)?.count ?? 0,
      lastBucketAt: totals.get(entity.id)?.lastBucketAt ?? null,
      bound: boundExperiments.some((experiment) => experiment.id === entity.id),
    }))
    .sort((a, b) => b.count - a.count);
}
