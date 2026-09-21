"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

// Plotly draws in the browser only. Every chart crosses this boundary, so none
// of it is compiled for, or shipped with, the server.
export const PlotlyChart = dynamic(
  () => import("@repo/ui/components/charts/plotly-chart").then((module) => module.PlotlyChart),
  { ssr: false, loading: ChartLoading },
);
