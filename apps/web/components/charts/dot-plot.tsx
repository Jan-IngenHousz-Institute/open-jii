"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const DotPlot = dynamic(
  () => import("@repo/ui/components/charts/dot-plot").then((module) => module.DotPlot),
  { ssr: false, loading: ChartLoading },
);

export const LollipopChart = dynamic(
  () => import("@repo/ui/components/charts/dot-plot").then((module) => module.LollipopChart),
  { ssr: false, loading: ChartLoading },
);
