import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/lib/orpc";

import { zExperimentDataJoin } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type {
  ExperimentDataJoin,
  ExperimentDataColumn,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

export interface ColumnMetadata {
  columns: ExperimentDataColumn[];
  isLoading: boolean;
  error: unknown;
}

const NO_COLUMNS: ExperimentDataColumn[] = [];

/**
 * The columns of a table, without its rows. Columns change only with the table's schema
 * revision, and the experiment's freshness poll refreshes them when it moves, so the answer
 * never goes stale on its own.
 */
export function useColumnMetadata(
  experimentId: string,
  tableName: string | undefined,
  join?: ExperimentDataJoin,
): ColumnMetadata {
  const validJoin = zExperimentDataJoin.safeParse(join);
  const { data, isLoading, error } = useQuery(
    orpc.experiments.getExperimentTableColumns.queryOptions({
      input: {
        id: experimentId,
        tableName: tableName ?? "",
        join: validJoin.success ? JSON.stringify(validJoin.data) : undefined,
      },
      meta: { secondaryTableName: validJoin.success ? validJoin.data.tableName : undefined },
      staleTime: Infinity,
      enabled: Boolean(tableName),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: shouldRetryQuery,
    }),
  );

  return { columns: data?.columns ?? NO_COLUMNS, isLoading, error };
}
