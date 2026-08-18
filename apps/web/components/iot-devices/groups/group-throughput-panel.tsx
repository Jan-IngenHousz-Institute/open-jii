"use client";

import { useState } from "react";

import type { DeviceGroupThroughputBucket } from "@repo/api/domains/device-group/device-group.schema";
import { useTranslation } from "@repo/i18n";
import { BarChart } from "@repo/ui/components/charts/bar-chart";

import { ChartTableToggle } from "../monitoring/chart-table-toggle";
import type { PanelView } from "../monitoring/chart-table-toggle";
import { bucketAxis } from "../monitoring/monitoring-buckets";
import { MONITORING_MAX_SERIES, MONITORING_SERIES_COLORS } from "../monitoring/monitoring-palette";
import type { MonitoringRange } from "../monitoring/monitoring-range";
import { GroupThroughputTable } from "./group-throughput-table";

interface GroupThroughputPanelProps {
  throughput: DeviceGroupThroughputBucket[];
  labelByDeviceId: Map<string, string>;
  range: MonitoringRange;
  locale: string;
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

// Fixed-order series assignment: alphabetical by member name, with everything
// past the palette folded into a single "Other" group. Mirrors the device
// panel's per-experiment stacking, member for experiment.
function buildSeries(
  buckets: DeviceGroupThroughputBucket[],
  labelByDeviceId: Map<string, string>,
  axis: string[],
  otherLabel: string,
  unknownLabel: string,
): ThroughputSeries[] {
  const byMember = new Map<string, Map<string, number>>();
  for (const bucket of buckets) {
    if (bucket.bucketStart === null) continue;
    const key = bucket.deviceId ?? "__unknown__";
    const perBucket = byMember.get(key) ?? new Map<string, number>();
    perBucket.set(bucket.bucketStart, (perBucket.get(bucket.bucketStart) ?? 0) + bucket.count);
    byMember.set(key, perBucket);
  }

  const nameFor = (key: string) =>
    key === "__unknown__" ? unknownLabel : (labelByDeviceId.get(key) ?? unknownLabel);

  const orderedKeys = [...byMember.keys()].sort((a, b) => nameFor(a).localeCompare(nameFor(b)));

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
      keys.reduce((sum, key) => sum + (byMember.get(key)?.get(bucketStart) ?? 0), 0),
    ),
  }));
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
  const total = throughput.reduce((sum, bucket) => sum + bucket.count, 0);

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
