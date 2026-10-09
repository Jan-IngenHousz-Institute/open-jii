import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "~/lib/orpc";

const STALE_TIME = 2 * 60 * 1000;

/**
 * Each table's row count from the experiment's table list, or undefined until the list is in. A
 * table the list does not name, or a list that failed, counts as empty, so its rows are read whole.
 */
export function useTableRowCounts(
  experimentId: string,
  enabled = true,
): ((tableName: string) => number) | undefined {
  const { data, error } = useQuery(
    orpc.experiments.getExperimentTables.queryOptions({
      input: { id: experimentId },
      staleTime: STALE_TIME,
      enabled,
    }),
  );

  return useMemo(() => {
    if (data === undefined && !error) {
      return undefined;
    }
    const counts = new Map((data ?? []).map((table) => [table.identifier, table.totalRows]));
    return (tableName: string) => counts.get(tableName) ?? 0;
  }, [data, error]);
}
