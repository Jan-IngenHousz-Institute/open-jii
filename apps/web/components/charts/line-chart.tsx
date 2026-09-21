"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const LineChart = dynamic(
  () => import("@repo/ui/components/charts/line-chart").then((module) => module.LineChart),
  { ssr: false, loading: ChartLoading },
);
