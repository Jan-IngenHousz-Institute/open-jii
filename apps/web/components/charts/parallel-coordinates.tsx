"use client";

import dynamic from "next/dynamic";

import { ChartLoading } from "./chart-loading";

export const Alluvial = dynamic(
  () => import("@repo/ui/components/charts/parallel-coordinates").then((module) => module.Alluvial),
  { ssr: false, loading: ChartLoading },
);

export const ParallelCoordinates = dynamic(
  () =>
    import("@repo/ui/components/charts/parallel-coordinates").then(
      (module) => module.ParallelCoordinates,
    ),
  { ssr: false, loading: ChartLoading },
);
