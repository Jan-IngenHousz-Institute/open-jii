"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const SPCChart = dynamic(
  () => import("@repo/ui/components/charts/spc-chart").then((module) => module.SPCChart),
  { ssr: false, loading: ChartLoading },
);
