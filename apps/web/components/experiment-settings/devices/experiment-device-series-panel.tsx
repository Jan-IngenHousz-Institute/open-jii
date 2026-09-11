"use client";

import { bucketAxis } from "@/components/iot-devices/monitoring/monitoring-buckets";
import { MONITORING_PRIMARY_COLOR } from "@/components/iot-devices/monitoring/monitoring-palette";
import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useExperimentDeviceSeries } from "@/hooks/experiment/useExperimentDeviceSeries/useExperimentDeviceSeries";

import { useTranslation } from "@repo/i18n";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

interface ExperimentDeviceSeriesPanelProps {
  experimentId: string;
  clientId: string;
  window: { from: string; to: string };
}

/**
 * What this one device sent into this experiment, per day across the tab's
 * window. Zero-filled from the axis so silent days read as gaps rather than a
 * compressed line.
 */
export function ExperimentDeviceSeriesPanel({
  experimentId,
  clientId,
  window,
}: ExperimentDeviceSeriesPanelProps) {
  const { t } = useTranslation("iot");
  const { data, isPending } = useExperimentDeviceSeries({
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

  function renderBody() {
    if (isPending) {
      return <Skeleton className="h-64 w-full" />;
    }
    if (data?.pipelineUnavailable === true) {
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
              color: MONITORING_PRIMARY_COLOR,
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
    >
      {renderBody()}
    </PanelCard>
  );
}
