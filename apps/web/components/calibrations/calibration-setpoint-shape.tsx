"use client";

import { ScatterChart } from "@/components/charts/scatter-chart";

import { useTranslation } from "@repo/i18n";

interface CalibrationSetpointShapeProps {
  values: number[];
  /** The setpoint's unit, where the sweep drives something that has one. */
  unit: string | undefined;
}

/** Two points make a line whatever the spacing, so the shape only says something above that. */
const MIN_POINTS = 3;

/**
 * The points a sweep will step through, drawn.
 *
 * They are authored as a column of numbers, which is the right way to edit them and a poor
 * way to read them: whether a ramp is even, doubles as it climbs, or crowds the bottom of
 * the range decides what the fit can see, and none of that is visible in a list.
 */
export function CalibrationSetpointShape({ values, unit }: CalibrationSetpointShapeProps) {
  const { t } = useTranslation("iot");

  if (values.length < MIN_POINTS) {
    return null;
  }

  const data = [
    {
      x: values.map((_, index) => index + 1),
      y: values,
      name: t("iot.calibration.procedure.values"),
      mode: "lines+markers" as const,
      line: { width: 1.5 },
    },
  ];

  // The span reads as this column's label, so it lines up with the one over the points.
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs tabular-nums">
        {t(
          unit === undefined
            ? "iot.calibration.procedure.sweepSpanPlain"
            : "iot.calibration.procedure.sweepSpan",
          { count: values.length, from: Math.min(...values), to: Math.max(...values), unit },
        )}
      </p>
      <ScatterChart
        className="h-24"
        data={data}
        config={{
          sparkline: true,
          showLegend: false,
          showHoverName: false,
          displayModeBar: false,
        }}
      />
    </div>
  );
}
