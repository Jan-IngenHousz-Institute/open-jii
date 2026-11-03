import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/lib/orpc";

import type {
  ExperimentDataJoin,
  ExperimentDataColumn,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isDataJoinValid } from "@repo/api/transforms/joined-columns";

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
  const validJoin = isDataJoinValid(join);
  const { data, isLoading, error } = useQuery(
    orpc.experiments.getExperimentTableColumns.queryOptions({
      input: {
        id: experimentId,
        tableName: tableName ?? "",
        join: validJoin && join ? JSON.stringify(join) : undefined,
      },
      meta: { secondaryTableName: validJoin ? join?.tableName : undefined },
      staleTime: Infinity,
      enabled: Boolean(tableName),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: shouldRetryQuery,
    }),
  );

  return { columns: data?.columns ?? NO_COLUMNS, isLoading, error };
}
