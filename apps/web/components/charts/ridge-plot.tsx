"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const RidgePlot = dynamic(
  () => import("@repo/ui/components/charts/ridge-plot").then((module) => module.RidgePlot),
  { ssr: false, loading: ChartLoading },
);
