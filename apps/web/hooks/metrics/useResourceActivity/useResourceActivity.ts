"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";

/** Activity for the resources of one kind the signed-in user may read. */
export function useResourceActivity(kind: ResourceKind) {
  return useQuery(orpc.metrics.getResourceActivity.queryOptions({ input: { kind } }));
}
