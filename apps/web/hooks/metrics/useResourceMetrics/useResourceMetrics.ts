"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";

/**
 * Activity for the resources of one kind the signed-in user may read. One key
 * per kind, so every row on the page reads the same cached response.
 */
export function useResourceMetrics(kind: ResourceKind) {
  return useQuery(orpc.metrics.getResourceMetrics.queryOptions({ input: { kind } }));
}
