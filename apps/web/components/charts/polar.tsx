"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const PolarPlot = dynamic(
  () => import("@repo/ui/components/charts/polar").then((module) => module.PolarPlot),
  { ssr: false, loading: ChartLoading },
);
