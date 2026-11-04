import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataResponse } from "@repo/api/domains/experiment/data/experiment-data.schema";
import {
  hasRelativeTimeFilters,
  relativeTimeFilterIdentities,
} from "@repo/api/transforms/relative-time-filter";

/** Share the evaluated minute across lazy consumers, then refresh on the next visit. */
export function relativeFilterStaleTime(query: {
  state: { data: ExperimentDataResponse | undefined; dataUpdatedAt: number };
}): number {
  const at = query.state.data?.[0]?.filterEvaluatedAt;
  if (!at) return 0;
  const deadline = Date.parse(at) + 60_000;
  if (!Number.isFinite(deadline)) return 0;
  // Clock skew cannot keep a rolling read fresh for longer than one minute.
  return Math.max(0, Math.min(60_000, deadline - query.state.dataUpdatedAt));
}

export function relativeFilterQueryOptions(
  filters: ExperimentDataFilter[] | undefined,
  staleTime: number,
) {
  return {
    meta: { relativeTimeFilters: relativeTimeFilterIdentities(filters) },
    staleTime: hasRelativeTimeFilters(filters) ? relativeFilterStaleTime : staleTime,
  };
}
