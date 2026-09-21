"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const ScatterChart = dynamic(
  () => import("@repo/ui/components/charts/scatter-chart").then((module) => module.ScatterChart),
  { ssr: false, loading: ChartLoading },
);
