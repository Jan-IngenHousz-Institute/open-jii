"use client";

import { useEffect } from "react";

import { preloadPlotly } from "./plotly-chart";

const NO_TRACE_TYPES: readonly string[] = [];

interface PlotlyPreloadProps {
  traceTypes?: readonly string[];
}

/**
 * Starts the Plotly download on mount, with the trace families the chart will
 * draw. Rendered where a chart will follow once its data arrives, so the
 * download overlaps the data wait instead of following it.
 */
export function PlotlyPreload({ traceTypes = NO_TRACE_TYPES }: PlotlyPreloadProps) {
  useEffect(() => {
    preloadPlotly(traceTypes);
  }, [traceTypes]);

  return null;
}
