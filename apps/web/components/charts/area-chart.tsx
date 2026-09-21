"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const AreaChart = dynamic(
  () => import("@repo/ui/components/charts/area-chart").then((module) => module.AreaChart),
  { ssr: false, loading: ChartLoading },
);
