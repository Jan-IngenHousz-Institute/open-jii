"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const CarpetPlot = dynamic(
  () => import("@repo/ui/components/charts/carpet").then((module) => module.CarpetPlot),
  { ssr: false, loading: ChartLoading },
);
