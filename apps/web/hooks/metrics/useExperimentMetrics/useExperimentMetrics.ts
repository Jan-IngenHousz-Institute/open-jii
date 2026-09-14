"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** One experiment's own measurement activity, gated by its read check. */
export function useExperimentMetrics(experimentId: string) {
  return useQuery(
    orpc.metrics.getScopedMetrics.queryOptions({
      input: { scope: "experiment", experimentId },
    }),
  );
}
