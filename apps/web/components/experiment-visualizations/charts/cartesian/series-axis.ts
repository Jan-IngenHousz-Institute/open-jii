import { zExperimentSeriesAxis } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import type {
  ExperimentSeriesAxis,
  ExperimentSeriesTraceType,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import type { IndexedDataSource } from "../data/data-sources";

const AXES = zExperimentSeriesAxis.options;
const FACET_AXES = AXES.slice(0, 2);

export function effectiveSeriesTraceType(
  traceType: ExperimentSeriesTraceType | undefined,
  seriesOrdinal: number,
  defaultTraceType: ExperimentSeriesTraceType,
): ExperimentSeriesTraceType {
  return seriesOrdinal === 0 ? defaultTraceType : (traceType ?? defaultTraceType);
}

export function canUseHorizontalBars(
  ySources: IndexedDataSource[],
  defaultTraceType: ExperimentSeriesTraceType | undefined,
): boolean {
  return (
    defaultTraceType === "bar" &&
    ySources.every(
      ({ source }, index) =>
        effectiveSeriesTraceType(source.traceType, index, defaultTraceType) === "bar",
    )
  );
}

export function availableSeriesAxes(faceted: boolean): readonly ExperimentSeriesAxis[] {
  return faceted ? FACET_AXES : AXES;
}

export function effectiveSeriesAxis(
  axis: ExperimentSeriesAxis | undefined,
  seriesOrdinal: number,
  faceted: boolean,
  horizontalBar = false,
): ExperimentSeriesAxis {
  if (seriesOrdinal === 0 || axis === undefined || horizontalBar) return "primary";
  return faceted && !FACET_AXES.includes(axis) ? "secondary" : axis;
}
