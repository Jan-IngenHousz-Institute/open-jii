"use client";

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
import { PanelCard } from "./panel-card";

interface BatteryPanelProps {
  monitoring: DeviceMonitoring;
}

/** Reported battery over the range; renders only when the family reports it. */
export function BatteryPanel({ monitoring }: BatteryPanelProps) {
  const { t } = useTranslation("iot");
  const [view, setView] = useState<PanelView>("chart");

  const points = monitoring.battery.filter((point) => point.averageBattery !== null);
  if (points.length === 0) {
    return null;
  }

  return (
    <PanelCard title={t("iot.devices.monitoring.batteryTitle")}>
      <div className="space-y-3">
        <div className="flex justify-end">
          <ChartTableToggle view={view} onViewChange={setView} />
        </div>

        {view === "chart" ? (
          <div className="h-56 w-full">
            <LineChart
              data={[
                {
                  name: t("iot.devices.monitoring.batterySeries"),
                  x: points.map((point) => point.bucketStart),
                  y: points.map((point) => point.averageBattery ?? 0),
                  mode: "lines+markers",
                  color: MONITORING_PRIMARY_COLOR,
                  connectgaps: false,
                },
              ]}
              config={{
                showLegend: false,
                showModeBar: false,
                xAxisType: "date",
                yAxisTitle: t("iot.devices.monitoring.batteryAxis"),
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
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
                      {formatBucketLabel(point.bucketStart, monitoring.bucket)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {point.averageBattery?.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
