"use client";

import { ScatterChart } from "@/components/charts/scatter-chart";

import { useTranslation } from "@repo/i18n";

import type { FitLine } from "./block-chart";

export interface FitPoint {
  x: number;
  y: number;
}

interface CalibrationFitChartProps {
  points: FitPoint[];
  /** `y = slope * x + intercept`; absent when the block's coefficients describe no line. */
  line: FitLine | null;
  /** The columns the script fitted, named as the captured series names them. */
  xLabel: string;
  yLabel: string;
}

export function CalibrationFitChart({ points, line, xLabel, yLabel }: CalibrationFitChartProps) {
  const { t } = useTranslation("iot");

  const xs = points.map((point) => point.x);
  const xMin = Math.min(0, ...xs);
  const xMax = Math.max(...xs);

  const captured = {
    name: t("iot.calibration.review.points"),
    x: xs,
    y: points.map((point) => point.y),
    mode: "markers" as const,
  };
  const fitted =
    line === null
      ? []
      : [
          {
            name: t("iot.calibration.review.fitLine"),
            x: [xMin, xMax],
            y: [line.slope * xMin + line.intercept, line.slope * xMax + line.intercept],
            mode: "lines" as const,
          },
        ];

  return (
    <ScatterChart
      className="h-56"
      data={[captured, ...fitted]}
      config={{ xAxisTitle: xLabel, yAxisTitle: yLabel, showLegend: true, displayModeBar: false }}
    />
  );
}
