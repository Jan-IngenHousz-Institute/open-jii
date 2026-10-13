import type { QueryUtils } from "@/lib/orpc";

const STALE_TIME = 2 * 60 * 1000;

/** An experiment's table list, built the same way for the hooks and the server that prefetches it. */
export function experimentTablesQuery(utils: QueryUtils, experimentId: string) {
  return utils.experiments.getExperimentTables.queryOptions({
    input: { id: experimentId },
    staleTime: STALE_TIME,
  });
}
