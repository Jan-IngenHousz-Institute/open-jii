import type { ExperimentDataResponse } from "@repo/api/domains/experiment/data/experiment-data.schema";

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
