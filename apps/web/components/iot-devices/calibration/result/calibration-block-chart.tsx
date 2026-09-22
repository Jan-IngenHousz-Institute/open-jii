"use client";

import type { CalibrationBlock } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { blockChart } from "./block-chart";
import { CalibrationFitChart } from "./calibration-fit-chart";
import { CalibrationVectorChart } from "./calibration-vector-chart";

/** Every block is owed a picture of what it claims; this is the one its shape calls for. */
export function CalibrationBlockChart({ block }: { block: CalibrationBlock }) {
  const chart = blockChart(block);
  if (chart === null) {
    return null;
  }

  if (chart.kind === "vector") {
    return <CalibrationVectorChart name={chart.name} values={chart.values} />;
  }

  return (
    <CalibrationFitChart
      points={chart.points}
      line={chart.line}
      xLabel={chart.x}
      yLabel={chart.y}
    />
  );
}
