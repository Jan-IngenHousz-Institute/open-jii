"use client";

import { useEffect } from "react";

import { preloadPlotly } from "./plotly-chart";

/**
 * Starts the Plotly download on mount. Rendered where a chart will follow once
 * its data arrives, so the download overlaps the data wait instead of
 * following it.
 */
export function PlotlyPreload() {
  useEffect(() => {
    preloadPlotly();
  }, []);

  return null;
}
