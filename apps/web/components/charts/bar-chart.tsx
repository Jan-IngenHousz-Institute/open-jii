"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const BarChart = dynamic(
  () => import("@repo/ui/components/charts/bar-chart").then((module) => module.BarChart),
  { ssr: false, loading: ChartLoading },
);

export const HorizontalBarChart = dynamic(
  () => import("@repo/ui/components/charts/bar-chart").then((module) => module.HorizontalBarChart),
  { ssr: false, loading: ChartLoading },
);
