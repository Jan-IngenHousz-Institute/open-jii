"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const ContourPlot = dynamic(
  () => import("@repo/ui/components/charts/contour").then((module) => module.ContourPlot),
  { ssr: false, loading: ChartLoading },
);
