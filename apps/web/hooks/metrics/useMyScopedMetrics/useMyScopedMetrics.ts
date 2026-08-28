"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** The signed-in user's own activity against the platform baseline. */
export function useMyScopedMetrics() {
  return useQuery(orpc.metrics.getScopedMetrics.queryOptions({ input: { scope: "mine" } }));
}
