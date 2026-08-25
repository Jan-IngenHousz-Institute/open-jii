"use client";

import { useState } from "react";

import type {
  DeviceExperiment,
  DeviceMonitoring,
  DeviceThroughputBucket,
} from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import { EmptyState } from "@repo/ui/components/empty-state";

import { ChartTableToggle } from "./chart-table-toggle";
import type { PanelView } from "./chart-table-toggle";
import { bucketAxis } from "./monitoring-buckets";
import { MONITORING_SERIES_COLORS } from "./monitoring-palette";
import { RecentMeasurements } from "./recent-measurements";
import type { EntityAccess } from "./resolve-entity-label";
import { foldThroughputSeries } from "./throughput-series";

interface ThroughputPanelProps {
  monitoring: DeviceMonitoring;
  boundExperiments: DeviceExperiment[];
  visibleExperiments: EntityAccess[];
  visibleProtocols: EntityAccess[];
  locale: string;
  from: string;
  to: string;
}

// Series identity per experiment; folding itself is shared with the group panel.
function buildSeries(
  buckets: DeviceThroughputBucket[],
  boundExperiments: DeviceExperiment[],
  axis: string[],
  otherLabel: string,
  unknownLabel: string,
) {
  const entries = buckets.map((bucket) => ({
    key: bucket.experimentId ?? "__unknown__",
    bucketStart: bucket.bucketStart,
    count: bucket.count,
  }));

  const nameFor = (key: string) =>
    key === "__unknown__"
      ? unknownLabel
      : (boundExperiments.find((experiment) => experiment.id === key)?.name ?? key);

  return foldThroughputSeries(entries, axis, nameFor, otherLabel);
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
        <EmptyState size="inline" description={t("iot.devices.monitoring.noMeasurements")} />
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
              showModeBar: true,
              modeBarStyle: "transparent",
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
