"use client";

import { LineChart } from "@/components/charts/line-chart";
import { useLocale } from "@/hooks/useLocale";
import { useState } from "react";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { useChartThemeRefresh } from "@repo/ui/components/charts/use-chart-theme-refresh";
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
import { monitoringPrimaryColor } from "./monitoring-palette";

interface BatteryPanelProps {
  monitoring: DeviceMonitoring;
  from?: string;
  to?: string;
}

/**
 * Reported battery over the window. The reading is whatever the firmware puts
 * in the payload (volts on some families, percent on others), so the panel
 * reports the trend and the range rather than asserting a unit.
 */
export function BatteryPanel({ monitoring, from, to }: BatteryPanelProps) {
  const { t } = useTranslation("iot");
  // Resolved in JS, so this has to learn about a theme swap itself.
  useChartThemeRefresh();
  const seriesColor = monitoringPrimaryColor();
  const locale = useLocale();
  const [view, setView] = useState<PanelView>("chart");

  const byBucket = new Map(
    monitoring.battery.map((point) => [new Date(point.bucketStart).toISOString(), point]),
  );
  const axis = from && to ? bucketAxis(from, to, monitoring.bucket) : [...byBucket.keys()].sort();
  const points = axis.map(
    (bucketStart) =>
      byBucket.get(bucketStart) ?? {
        bucketStart,
        averageBattery: null,
        sampleCount: 0,
        reportedCount: 0,
        latestAt: null,
        latestBattery: null,
        lastReportedAt: null,
      },
  );
  const values = points.map((point) =>
    point.averageBattery !== null && Number.isFinite(point.averageBattery)
      ? point.averageBattery
      : null,
  );
  const available = values.filter((value): value is number => value !== null);
  const last = points.at(-1);
  const latest = last?.latestBattery === undefined ? (values.at(-1) ?? null) : last.latestBattery;
  const lastReport = points
    .flatMap((point) => (point.lastReportedAt ? [point.lastReportedAt] : []))
    .sort()
    .at(-1);
  const lastBucket = points.filter((point) => point.averageBattery !== null).at(-1)?.bucketStart;
  const coverageKnown = points.every(
    (point) => point.sampleCount !== undefined && point.reportedCount !== undefined,
  );
  const samples = points.reduce((n, point) => n + (point.sampleCount ?? 0), 0);
  const reported = points.reduce((n, point) => n + (point.reportedCount ?? 0), 0);
  const missing = t("iot.devices.monitoring.batteryMissing");

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-6">
          <Figure
            label={t(
              last?.latestBattery === undefined
                ? "iot.devices.monitoring.batteryFinalMean"
                : "iot.devices.monitoring.batteryLatest",
            )}
            value={latest === null ? missing : latest.toFixed(2)}
          />
          <Figure
            label={t(
              lastReport
                ? "iot.devices.monitoring.batteryLastReport"
                : "iot.devices.monitoring.batteryLastBucket",
            )}
            value={
              lastReport
                ? new Date(lastReport).toLocaleString(locale, { timeZoneName: "short" })
                : lastBucket
                  ? formatBucketLabel(lastBucket, monitoring.bucket, locale, "UTC")
                  : missing
            }
          />
          <Figure
            label={t("iot.devices.monitoring.batteryRange")}
            value={
              available.length
                ? `${Math.min(...available).toFixed(2)} – ${Math.max(...available).toFixed(2)}`
                : missing
            }
          />
        </div>
        <ChartTableToggle view={view} onViewChange={setView} />
      </div>

      <p className="text-muted-foreground text-sm">
        {t("iot.devices.monitoring.batteryProvenance")}
      </p>
      <p className="text-muted-foreground text-xs">
        {t("iot.devices.monitoring.batteryBucketCoverage", {
          reported: available.length,
          total: points.length,
        })}
        {coverageKnown &&
          ` · ${t("iot.devices.monitoring.batteryMessageCoverage", { reported, total: samples })}`}
      </p>
      {available.length === 0 && (
        <p role="status">{t("iot.devices.monitoring.batteryUnavailable")}</p>
      )}
      {view === "chart" ? (
        available.length > 0 && (
          <div className="h-52 w-full">
            <LineChart
              data={[
                {
                  name: t("iot.devices.monitoring.batterySeries"),
                  x: axis,
                  y: values,
                  mode: "lines+markers",
                  color: seriesColor,
                  connectgaps: false,
                },
              ]}
              config={{
                showLegend: false,
                showModeBar: true,
                modeBarStyle: "transparent",
                xAxisType: "date",
                xAxisTitle: t("iot.devices.monitoring.batteryTimeAxis"),
                yAxisTitle: t("iot.devices.monitoring.batteryAxis"),
              }}
            />
          </div>
        )
      ) : (
        <div className="max-h-52 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("iot.devices.monitoring.batteryTimeAxis")}</TableHead>
                <TableHead className="text-right">
                  {t("iot.devices.monitoring.batteryAxis")}
                </TableHead>
                <TableHead>{t("iot.devices.monitoring.batteryCoverageTitle")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.bucketStart}>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatBucketLabel(point.bucketStart, monitoring.bucket, locale, "UTC")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {point.averageBattery === null ? missing : point.averageBattery.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {point.reportedCount === undefined || point.sampleCount === undefined
                      ? missing
                      : `${point.reportedCount} / ${point.sampleCount}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}
