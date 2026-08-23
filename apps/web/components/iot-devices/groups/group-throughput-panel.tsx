"use client";

import { useState } from "react";

import type { IotDeviceGroupThroughputBucket } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import { EmptyState } from "@repo/ui/components/empty-state";

import { ChartTableToggle } from "../monitoring/chart-table-toggle";
import type { PanelView } from "../monitoring/chart-table-toggle";
import { bucketAxis } from "../monitoring/monitoring-buckets";
import { MONITORING_SERIES_COLORS } from "../monitoring/monitoring-palette";
import type { MonitoringRange } from "../monitoring/monitoring-range";
import { foldThroughputSeries } from "../monitoring/throughput-series";
import { GroupThroughputTable } from "./group-throughput-table";

interface GroupThroughputPanelProps {
  throughput: IotDeviceGroupThroughputBucket[];
  labelByDeviceId: Map<string, string>;
  range: MonitoringRange;
  locale: string;
}

// Series identity per member; folding itself is shared with the device panel.
function buildSeries(
  buckets: IotDeviceGroupThroughputBucket[],
  labelByDeviceId: Map<string, string>,
  axis: string[],
  otherLabel: string,
  unknownLabel: string,
) {
  const entries = buckets.flatMap((bucket) =>
    bucket.bucketStart === null
      ? []
      : [
          {
            key: bucket.deviceId ?? "__unknown__",
            bucketStart: bucket.bucketStart,
            count: bucket.count,
          },
        ],
  );

  const nameFor = (key: string) =>
    key === "__unknown__" ? unknownLabel : (labelByDeviceId.get(key) ?? unknownLabel);

  return foldThroughputSeries(entries, axis, nameFor, otherLabel);
}

/**
 * Measurements over the range, stacked per member. Zero-filled buckets keep
 * silent periods visible as real gaps instead of a compressed axis.
 */
export function GroupThroughputPanel({
  throughput,
  labelByDeviceId,
  range,
  locale,
}: GroupThroughputPanelProps) {
  const { t } = useTranslation("iot");
  const [view, setView] = useState<PanelView>("chart");

  const axis = bucketAxis(range.from, range.to, range.bucket);
  const series = buildSeries(
    throughput,
    labelByDeviceId,
    axis,
    t("iot.devices.monitoring.otherSeries"),
    t("iot.groups.monitoring.unknownMember"),
  );
  // Sum what the chart and table actually show: rows without a bucket are dropped there too.
  const total = throughput.reduce(
    (sum, bucket) => (bucket.bucketStart === null ? sum : sum + bucket.count),
    0,
  );

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
        <GroupThroughputTable series={series} axis={axis} locale={locale} />
      )}
    </div>
  );
}
