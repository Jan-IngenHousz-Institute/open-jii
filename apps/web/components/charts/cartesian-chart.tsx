"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const CartesianChart = dynamic(
  () =>
    import("@repo/ui/components/charts/cartesian-chart").then((module) => module.CartesianChart),
  { ssr: false, loading: ChartLoading },
);
