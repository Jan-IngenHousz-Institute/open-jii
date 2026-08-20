"use client";

import { formatRelativeTime } from "@/util/date";

import type { IotDeviceGroupExperimentBucket } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { HorizontalBarChart } from "@repo/ui/components/charts/bar-chart";

import { EntityLink } from "../monitoring/entity-link";
import { MONITORING_PRIMARY_COLOR } from "../monitoring/monitoring-palette";
import type { EntityAccess, ResolvedEntity } from "../monitoring/resolve-entity-label";
import { resolveEntities } from "../monitoring/resolve-entity-label";

interface GroupDataByExperimentPanelProps {
  dataByExperiment: IotDeviceGroupExperimentBucket[];
  /** Experiments the viewer is a member of; the rest stay unnamed. */
  visibleExperiments: EntityAccess[];
  locale: string;
}

interface ExperimentRow {
  entity: ResolvedEntity;
  count: number;
  lastBucketAt: string | null;
}

const UNKNOWN_KEY = "__unknown__";

/**
 * Where the whole group's data landed, per experiment: volume for comparison,
 * a row per experiment for recency and the link out. Viewer-inaccessible
 * experiments stay deliberately unnamed, same as the device panel.
 */
export function GroupDataByExperimentPanel({
  dataByExperiment,
  visibleExperiments,
  locale,
}: GroupDataByExperimentPanelProps) {
  const { t } = useTranslation("iot");

  const rows = buildRows(
    dataByExperiment,
    visibleExperiments,
    locale,
    (index) => t("iot.devices.monitoring.privateExperiment", { index }),
    t("iot.devices.monitoring.unknownExperiment"),
  );

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.devices.monitoring.noExperiments")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="w-full" style={{ height: `${String(Math.max(208, rows.length * 44))}px` }}>
        <HorizontalBarChart
          data={[
            {
              name: t("iot.devices.monitoring.measurements"),
              x: rows.map((row) => row.count),
              y: rows.map((row) => row.entity.label),
              color: MONITORING_PRIMARY_COLOR,
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

      <ul className="divide-y rounded-lg border">
        {rows.map((row) => (
          <li key={row.entity.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <EntityLink entity={row.entity} />
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">
              {row.lastBucketAt !== null && formatRelativeTime(row.lastBucketAt, locale)}
            </span>
            <span className="shrink-0 tabular-nums">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildRows(
  buckets: IotDeviceGroupExperimentBucket[],
  visibleExperiments: EntityAccess[],
  locale: string,
  privateLabel: (index: number) => string,
  unknownLabel: string,
): ExperimentRow[] {
  const totals = new Map<string, { count: number; lastBucketAt: string | null }>();
  for (const bucket of buckets) {
    const key = bucket.experimentId ?? UNKNOWN_KEY;
    const entry = totals.get(key) ?? { count: 0, lastBucketAt: null };
    entry.count += bucket.count;
    if (
      bucket.bucketStart !== null &&
      (entry.lastBucketAt === null || bucket.bucketStart > entry.lastBucketAt)
    ) {
      entry.lastBucketAt = bucket.bucketStart;
    }
    totals.set(key, entry);
  }

  const experimentIds = [...totals.keys()].filter((key) => key !== UNKNOWN_KEY);
  const resolved = resolveEntities(
    experimentIds,
    visibleExperiments,
    (id) => `/${locale}/platform/experiments/${id}`,
    privateLabel,
  );

  const rows: ExperimentRow[] = [...totals.entries()].map(([key, entry]) => ({
    entity:
      key === UNKNOWN_KEY
        ? { id: UNKNOWN_KEY, label: unknownLabel, href: null, accessible: false }
        : (resolved.get(key) ?? { id: key, label: key, href: null, accessible: false }),
    count: entry.count,
    lastBucketAt: entry.lastBucketAt,
  }));

  return rows.sort((a, b) => b.count - a.count);
}
