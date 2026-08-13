"use client";

import { useState } from "react";

import type {
  DeviceExperiment,
  DeviceMonitoring,
  DeviceThroughputBucket,
} from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { ChartTableToggle } from "./chart-table-toggle";
import type { PanelView } from "./chart-table-toggle";
import { bucketAxis, formatBucketLabel } from "./monitoring-buckets";
import { MONITORING_MAX_SERIES, MONITORING_SERIES_COLORS } from "./monitoring-palette";

interface ThroughputPanelProps {
  monitoring: DeviceMonitoring;
  boundExperiments: DeviceExperiment[];
  from: string;
  to: string;
}

interface ThroughputSeries {
  key: string;
  name: string;
  counts: number[];
}

// Fixed-order series assignment: bound experiments first (by name), then any
// unbound publishers, with everything past the palette folded into "Other".
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

  const head = orderedKeys.slice(0, MONITORING_MAX_SERIES - 1);
  const tail = orderedKeys.slice(MONITORING_MAX_SERIES - 1);
  const grouped = tail.length > 1 ? [...head, tail] : orderedKeys.map((key) => key);

  return grouped.map((entry): ThroughputSeries => {
    const keys = Array.isArray(entry) ? entry : [entry];
    const counts = axis.map((bucketStart) =>
      keys.reduce((sum, key) => sum + (byExperiment.get(key)?.get(bucketStart) ?? 0), 0),
    );
    return {
      key: keys.join("+"),
      name: Array.isArray(entry) ? otherLabel : nameFor(entry),
      counts,
    };
  });
}

/**
 * Measurements over the range, stacked per experiment. Zero-filled buckets
 * keep silent periods visible as real gaps instead of a compressed axis.
 */
export function ThroughputPanel({ monitoring, boundExperiments, from, to }: ThroughputPanelProps) {
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

      {view === "chart" ? (
        <BarChart
          className="h-64"
          barmode="stack"
          bargap={0.15}
          data={series.map((entry, index) => ({
            name: entry.name,
            x: axis.map((bucketStart) => formatBucketLabel(bucketStart, monitoring.bucket)),
            y: entry.counts,
            color: MONITORING_SERIES_COLORS[index % MONITORING_SERIES_COLORS.length],
          }))}
          config={{
            showLegend: series.length > 1,
            showModeBar: false,
            yAxisTitle: t("iot.devices.monitoring.measurements"),
          }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("iot.devices.monitoring.bucketColumn")}</TableHead>
                {series.map((entry) => (
                  <TableHead key={entry.key} className="text-right">
                    {entry.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {axis.map((bucketStart, bucketIndex) => (
                <TableRow key={bucketStart}>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatBucketLabel(bucketStart, monitoring.bucket)}
                  </TableCell>
                  {series.map((entry) => (
                    <TableCell key={entry.key} className="text-right tabular-nums">
                      {entry.counts[bucketIndex]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
