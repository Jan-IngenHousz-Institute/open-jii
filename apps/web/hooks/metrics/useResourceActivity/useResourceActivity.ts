"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";

/**
 * Activity for the resources of one kind the signed-in user may read.
 *
 * `ids` narrows the returned series to the rows on screen; the totals still
 * describe everything visible. Every cell on a page passes the same ids, so
 * React Query hashes one key and the table makes a single request.
 */
export function useResourceActivity(kind: ResourceKind, ids?: string[]) {
  return useQuery(
    orpc.metrics.getResourceActivity.queryOptions({
      input: ids === undefined ? { kind } : { kind, ids },
    }),
  );
}
