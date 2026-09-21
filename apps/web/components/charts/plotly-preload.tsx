"use client";

import dynamic from "next/dynamic";

export const PlotlyPreload = dynamic(
  () => import("@repo/ui/components/charts/plotly-preload").then((module) => module.PlotlyPreload),
  { ssr: false },
);
