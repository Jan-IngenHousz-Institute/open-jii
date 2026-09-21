"use client";

import { ScatterChart } from "@/components/charts/scatter-chart";

import { useTranslation } from "@repo/i18n";

import type { ResidualReport } from "./residual-data";

/**
 * How far the fit missed at each point, against the band the gate allowed.
 *
 * A single R² says a line fits; it does not say where it does not. The scripts compute every
 * residual and the threshold each was judged against, and until now the record kept both and
 * showed neither, so a systematic bend at the bright end read the same as noise.
 */
export function CalibrationResidualChart({ report }: { report: ResidualReport }) {
  const { t } = useTranslation("iot");

  const xs = report.points.map((point) => point.x);
  const measured = {
    name: t("iot.calibration.review.residuals"),
    x: xs,
    y: report.points.map((point) => point.fraction * 100),
    mode: "markers" as const,
  };

  // The gate's own band, drawn as the two lines it is, so a point outside it is visibly out.
  const band =
    report.tolerance === null
      ? []
      : [-report.tolerance, report.tolerance].map((edge, index) => ({
          name: t("iot.calibration.review.tolerance"),
          x: [Math.min(...xs), Math.max(...xs)],
          y: [edge * 100, edge * 100],
          mode: "lines" as const,
          showlegend: index === 0,
        }));

  return (
    <ScatterChart
      className="h-44"
      data={[measured, ...band]}
      config={{
        xAxisTitle: report.xLabel ?? undefined,
        yAxisTitle: t("iot.calibration.review.residualAxis"),
        showLegend: report.tolerance !== null,
        displayModeBar: false,
      }}
    />
  );
}
