"use client";

import { useTranslation } from "@repo/i18n";
import { ScatterChart } from "@repo/ui/components/charts/scatter-chart";

export interface FitPoint {
  x: number;
  y: number;
}

interface CalibrationFitChartProps {
  points: FitPoint[];
  /** `y = slope * x + intercept`; a through-origin fit passes intercept 0. */
  slope: number;
  intercept: number;
}

export function CalibrationFitChart({ points, slope, intercept }: CalibrationFitChartProps) {
  const { t } = useTranslation("iot");

  const xs = points.map((point) => point.x);
  const xMin = Math.min(0, ...xs);
  const xMax = Math.max(...xs);

  return (
    <ScatterChart
      className="h-64"
      data={[
        {
          name: t("iot.calibration.review.points"),
          x: xs,
          y: points.map((point) => point.y),
          mode: "markers",
        },
        {
          name: t("iot.calibration.review.fitLine"),
          x: [xMin, xMax],
          y: [slope * xMin + intercept, slope * xMax + intercept],
          mode: "lines",
        },
      ]}
      config={{
        xAxisTitle: t("iot.calibration.review.xLabel"),
        yAxisTitle: t("iot.calibration.review.yLabel"),
        showLegend: true,
      }}
    />
  );
}
