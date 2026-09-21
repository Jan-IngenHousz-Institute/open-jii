"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const TernaryPlot = dynamic(
  () => import("@repo/ui/components/charts/ternary").then((module) => module.TernaryPlot),
  { ssr: false, loading: ChartLoading },
);
