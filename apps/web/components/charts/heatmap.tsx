"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const CorrelationMatrix = dynamic(
  () => import("@repo/ui/components/charts/heatmap").then((module) => module.CorrelationMatrix),
  { ssr: false, loading: ChartLoading },
);

export const Heatmap = dynamic(
  () => import("@repo/ui/components/charts/heatmap").then((module) => module.Heatmap),
  { ssr: false, loading: ChartLoading },
);
