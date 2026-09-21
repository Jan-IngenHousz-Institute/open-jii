"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const DensityPlot2D = dynamic(
  () => import("@repo/ui/components/charts/density-plot-2d").then((module) => module.DensityPlot2D),
  { ssr: false, loading: ChartLoading },
);
