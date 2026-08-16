"use client";

import { useLocale } from "@/hooks/useLocale";
import { useState } from "react";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { LineChart } from "@repo/ui/components/charts/line-chart";
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
import { formatBucketLabel } from "./monitoring-buckets";
import { MONITORING_PRIMARY_COLOR } from "./monitoring-palette";

interface BatteryPanelProps {
  monitoring: DeviceMonitoring;
}

/**
 * Reported battery over the window. The reading is whatever the firmware puts
 * in the payload (volts on some families, percent on others), so the panel
 * reports the trend and the range rather than asserting a unit.
 */
export function BatteryPanel({ monitoring }: BatteryPanelProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const [view, setView] = useState<PanelView>("chart");

  const points = monitoring.battery.flatMap((point) =>
    point.averageBattery === null ? [] : [{ ...point, averageBattery: point.averageBattery }],
  );
  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.averageBattery);
  const first = values[0];
  const latest = values[values.length - 1];
  const change = latest - first;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-6">
          <Figure label={t("iot.devices.monitoring.batteryLatest")} value={latest.toFixed(2)} />
          <Figure
            label={t("iot.devices.monitoring.batteryChange")}
            value={`${change >= 0 ? "+" : ""}${change.toFixed(2)}`}
          />
          <Figure
            label={t("iot.devices.monitoring.batteryRange")}
            value={`${Math.min(...values).toFixed(2)} – ${Math.max(...values).toFixed(2)}`}
          />
        </div>
        <ChartTableToggle view={view} onViewChange={setView} />
      </div>

      {view === "chart" ? (
        <div className="h-52 w-full">
          <LineChart
            data={[
              {
                name: t("iot.devices.monitoring.batterySeries"),
                x: points.map((point) => point.bucketStart),
                y: values,
                mode: "lines+markers",
                color: MONITORING_PRIMARY_COLOR,
                connectgaps: false,
              },
            ]}
            config={{
              showLegend: false,
              showModeBar: true,
              modeBarStyle: "transparent",
              xAxisType: "date",
              yAxisTitle: t("iot.devices.monitoring.batteryAxis"),
            }}
          />
        </div>
      ) : (
        <div className="max-h-52 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("iot.devices.monitoring.bucketColumn")}</TableHead>
                <TableHead className="text-right">
                  {t("iot.devices.monitoring.batteryAxis")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.bucketStart}>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatBucketLabel(point.bucketStart, monitoring.bucket, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {point.averageBattery.toFixed(2)}
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
