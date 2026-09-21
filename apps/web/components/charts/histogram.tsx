"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const Histogram = dynamic(
  () => import("@repo/ui/components/charts/histogram").then((module) => module.Histogram),
  { ssr: false, loading: ChartLoading },
);

export const Histogram2D = dynamic(
  () => import("@repo/ui/components/charts/histogram").then((module) => module.Histogram2D),
  { ssr: false, loading: ChartLoading },
);
