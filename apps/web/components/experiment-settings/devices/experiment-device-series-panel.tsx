"use client";

import { bucketAxis } from "@/components/iot-devices/monitoring/monitoring-buckets";
import { monitoringPrimaryColor } from "@/components/iot-devices/monitoring/monitoring-palette";
import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useExperimentDeviceSeries } from "@/hooks/experiment/useExperimentDeviceSeries/useExperimentDeviceSeries";
import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import { useChartThemeRefresh } from "@repo/ui/components/charts/use-chart-theme-refresh";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

interface ExperimentDeviceSeriesPanelProps {
  experimentId: string;
  clientId: string;
  window: { from: string; to: string };
  action?: ReactNode;
}

/** Zero-filled from the axis, so a silent day reads as a gap rather than a missing point. */
export function ExperimentDeviceSeriesPanel({
  experimentId,
  clientId,
  window,
  action,
}: ExperimentDeviceSeriesPanelProps) {
  const { t } = useTranslation("iot");
  // Resolved in JS, so this has to learn about a theme swap itself.
  useChartThemeRefresh();
  const seriesColor = monitoringPrimaryColor();
  const { data, isPending, isError } = useExperimentDeviceSeries({
    experimentId,
    clientId,
    from: window.from,
    to: window.to,
  });

  const axis = bucketAxis(window.from, window.to, "day");
  const countByBucket = new Map(
    (data?.buckets ?? []).flatMap((bucket) =>
      bucket.bucketStart === null ? [] : [[bucket.bucketStart, bucket.count] as const],
    ),
  );
  const counts = axis.map((bucketStart) => countByBucket.get(bucketStart) ?? 0);
  const total = counts.reduce((sum, count) => sum + count, 0);

  // A failed request knows nothing about this device's volume, so it reads as
  // unavailable rather than as a silent window.
  const isSeriesUnavailable = isError || data?.pipelineUnavailable === true;

  function renderBody() {
    if (isPending) {
      return <Skeleton className="h-64 w-full" />;
    }
    if (isSeriesUnavailable) {
      return <EmptyState size="inline" description={t("iot.experimentDevices.chartUnavailable")} />;
    }
    if (total === 0) {
      return <EmptyState size="inline" description={t("iot.experimentDevices.chartEmpty")} />;
    }

    return (
      <div className="h-64 w-full">
        <BarChart
          bargap={0.15}
          data={[
            {
              name: t("iot.experimentDevices.measurementsSeries"),
              // Instants on a real time axis: the chart layer defaults
              // `xaxis.type` to linear, which cannot place label strings.
              x: axis,
              y: counts,
              color: seriesColor,
            },
          ]}
          config={{
            showLegend: false,
            showModeBar: true,
            modeBarStyle: "transparent",
            xAxisType: "date",
            yAxisTitle: t("iot.experimentDevices.measurementsSeries"),
          }}
        />
      </div>
    );
  }

  return (
    <PanelCard
      title={t("iot.experimentDevices.chartTitle")}
      description={t("iot.experimentDevices.chartDescription")}
      action={action}
    >
      {renderBody()}
    </PanelCard>
  );
}
