"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const WindRose = dynamic(
  () => import("@repo/ui/components/charts/wind-rose").then((module) => module.WindRose),
  { ssr: false, loading: ChartLoading },
);
