"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const BoxPlot = dynamic(
  () => import("@repo/ui/components/charts/box-plot").then((module) => module.BoxPlot),
  { ssr: false, loading: ChartLoading },
);

export const ViolinPlot = dynamic(
  () => import("@repo/ui/components/charts/box-plot").then((module) => module.ViolinPlot),
  { ssr: false, loading: ChartLoading },
);
