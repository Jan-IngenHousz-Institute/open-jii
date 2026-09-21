"use client";

import { BarChart } from "@/components/charts/bar-chart";

/**
 * A coefficient that is a vector: one bar per element. Six dark detector channels or ten
 * spectral coefficients are a shape, and a row of numbers is the one thing that hides it.
 */
export function CalibrationVectorChart({ name, values }: { name: string; values: number[] }) {
  return (
    <BarChart
      className="h-48"
      data={[
        {
          name,
          x: values.map((_, index) => index + 1),
          y: values,
        },
      ]}
      config={{ xAxisTitle: name, showLegend: false, displayModeBar: false }}
    />
  );
}
