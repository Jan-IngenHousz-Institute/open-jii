import { zExperimentSeriesAxis } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import type { ExperimentSeriesAxis } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

const AXES = zExperimentSeriesAxis.options;
const FACET_AXES = AXES.slice(0, 2);

export function availableSeriesAxes(faceted: boolean): readonly ExperimentSeriesAxis[] {
  return faceted ? FACET_AXES : AXES;
}

export function effectiveSeriesAxis(
  axis: ExperimentSeriesAxis | undefined,
  seriesOrdinal: number,
  faceted: boolean,
): ExperimentSeriesAxis {
  if (seriesOrdinal === 0 || axis === undefined) return "primary";
  return faceted && !FACET_AXES.includes(axis) ? "secondary" : axis;
}
