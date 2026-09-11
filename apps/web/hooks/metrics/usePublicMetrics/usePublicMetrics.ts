"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Public platform metrics snapshot; the backend caches it for ~10 minutes. */
export function usePublicMetrics() {
  return useQuery(orpc.metrics.getPublicMetrics.queryOptions());
}
