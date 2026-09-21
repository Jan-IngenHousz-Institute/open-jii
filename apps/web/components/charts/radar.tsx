"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const RadarPlot = dynamic(
  () => import("@repo/ui/components/charts/radar").then((module) => module.RadarPlot),
  { ssr: false, loading: ChartLoading },
);
