"use client";

import { useState } from "react";

import type {
  DeviceExperiment,
  DeviceMonitoring,
  DeviceThroughputBucket,
} from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { BarChart } from "@repo/ui/components/charts/bar-chart";

import { ChartTableToggle } from "./chart-table-toggle";
import type { PanelView } from "./chart-table-toggle";
import { bucketAxis } from "./monitoring-buckets";
import { MONITORING_MAX_SERIES, MONITORING_SERIES_COLORS } from "./monitoring-palette";
import { RecentMeasurements } from "./recent-measurements";
import type { EntityAccess } from "./resolve-entity-label";

interface ThroughputPanelProps {
  monitoring: DeviceMonitoring;
  boundExperiments: DeviceExperiment[];
  visibleExperiments: EntityAccess[];
  visibleProtocols: EntityAccess[];
  locale: string;
  from: string;
  to: string;
}

interface ThroughputSeries {
  key: string;
  name: string;
  counts: number[];
}

interface SeriesGroup {
  name: string;
  keys: string[];
}

// Fixed-order series assignment: alphabetical by display name, with
// everything past the palette folded into a single "Other" group.
function buildSeries(
  buckets: DeviceThroughputBucket[],
  boundExperiments: DeviceExperiment[],
  axis: string[],
  otherLabel: string,
  unknownLabel: string,
): ThroughputSeries[] {
  const byExperiment = new Map<string, Map<string, number>>();
  for (const bucket of buckets) {
    const key = bucket.experimentId ?? "__unknown__";
    const perBucket = byExperiment.get(key) ?? new Map<string, number>();
    perBucket.set(bucket.bucketStart, (perBucket.get(bucket.bucketStart) ?? 0) + bucket.count);
    byExperiment.set(key, perBucket);
  }

  const nameFor = (key: string) =>
    key === "__unknown__"
      ? unknownLabel
      : (boundExperiments.find((experiment) => experiment.id === key)?.name ?? key);

  const orderedKeys = [...byExperiment.keys()].sort((a, b) => nameFor(a).localeCompare(nameFor(b)));

  const needsOtherGroup = orderedKeys.length > MONITORING_MAX_SERIES;
  const groups: SeriesGroup[] = needsOtherGroup
    ? [
        ...orderedKeys
          .slice(0, MONITORING_MAX_SERIES - 1)
          .map((key) => ({ name: nameFor(key), keys: [key] })),
        { name: otherLabel, keys: orderedKeys.slice(MONITORING_MAX_SERIES - 1) },
      ]
    : orderedKeys.map((key) => ({ name: nameFor(key), keys: [key] }));

  return groups.map(({ name, keys }) => ({
    key: keys.join("+"),
    name,
    counts: axis.map((bucketStart) =>
      keys.reduce((sum, key) => sum + (byExperiment.get(key)?.get(bucketStart) ?? 0), 0),
    ),
  }));
}

/**
 * Measurements over the range, stacked per experiment. Zero-filled buckets
 * keep silent periods visible as real gaps instead of a compressed axis.
 */
export function ThroughputPanel({
  monitoring,
  boundExperiments,
  visibleExperiments,
  visibleProtocols,
  locale,
  from,
  to,
}: ThroughputPanelProps) {
  const { t } = useTranslation("iot");
  const [view, setView] = useState<PanelView>("chart");

  const axis = bucketAxis(from, to, monitoring.bucket);
  const series = buildSeries(
    monitoring.throughput,
    boundExperiments,
    axis,
    t("iot.devices.monitoring.otherSeries"),
    t("iot.devices.monitoring.unknownExperiment"),
  );
  const total = monitoring.throughput.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {t("iot.devices.monitoring.throughputTotal", { count: total })}
        </p>
        <ChartTableToggle view={view} onViewChange={setView} />
      </div>

      {total === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          {t("iot.devices.monitoring.noMeasurements")}
        </p>
      ) : view === "chart" ? (
        <div className="h-64 w-full">
          <BarChart
            barmode="stack"
            bargap={0.15}
            data={series.map((entry, index) => ({
              name: entry.name,
              // Instants on a real time axis: the chart layer defaults
              // `xaxis.type` to linear, which cannot place label strings.
              x: axis,
              y: entry.counts,
              color: MONITORING_SERIES_COLORS[index % MONITORING_SERIES_COLORS.length],
            }))}
            config={{
              showLegend: series.length > 1,
              showModeBar: false,
              xAxisType: "date",
              yAxisTitle: t("iot.devices.monitoring.measurements"),
            }}
          />
        </div>
      ) : (
        <RecentMeasurements
          measurements={monitoring.recentMeasurements}
          visibleExperiments={visibleExperiments}
          visibleProtocols={visibleProtocols}
          locale={locale}
        />
      )}
    </div>
  );
}
