import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { ExperimentListExportsResponse } from "@repo/api/domains/experiment/exports/experiment-exports.schema";

const POLL_MS = 15_000;
const FINISHED_STATUSES = new Set(["completed", "failed", "expired"]);

function hasUnfinishedExport(data: ExperimentListExportsResponse | undefined): boolean {
  return data?.exports.some((record) => !FINISHED_STATUSES.has(record.status)) ?? false;
}

/**
 * Lists a table's exports, polling only while one is still running. Starting a new export
 * invalidates the list, which starts polling again.
 */
export const useListExports = ({
  experimentId,
  tableName,
}: {
  experimentId: string;
  tableName: string;
}) => {
  return useQuery(
    orpc.experiments.listExports.queryOptions({
      input: { id: experimentId, tableName },
      refetchInterval: (query) => (hasUnfinishedExport(query.state.data) ? POLL_MS : false),
    }),
  );
};
