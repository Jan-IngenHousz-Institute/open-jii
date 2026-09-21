"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const PieChart = dynamic(
  () => import("@repo/ui/components/charts/pie-chart").then((module) => module.PieChart),
  { ssr: false, loading: ChartLoading },
);
