import { useIsIdle } from "@/hooks/useIsIdle";
import { orpc } from "@/lib/orpc";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";

const POLL_MS = 30_000;
/** The backend holds the listing this long, so an earlier refetch gets the same answer. */
const BACKEND_CACHE_MS = 15_000;
const BEHIND_AFTER_MS = 2 * 60_000;

export type DataFreshnessStatus = "live" | "paused" | "behind";

function newestOf(
  tables: ExperimentTableMetadata[],
  tableNames: string[] | undefined,
): string | null {
  const times = tables
    .filter((table) => tableNames === undefined || tableNames.includes(table.identifier))
    .flatMap((table) => (table.latestRowAt ? [table.latestRowAt] : []));
  return times.length > 0 ? times.reduce((a, b) => (a > b ? a : b)) : null;
}

function versionOf(table: ExperimentTableMetadata): string {
  return `${table.totalRows}|${table.latestRowAt}|${table.schemaRevision}`;
}

/**
 * Polls the experiment's table listing while the page is visible and in use, and
 * refetches a table's rows and charts only when its count, newest row or schema
 * moves, and its columns only when its schema does, so an open page follows the
 * pipeline without resetting what the user is doing. `tableNames` picks whose
 * newest data to report; omitted, the whole experiment.
 */
export const useExperimentDataFreshness = (experimentId: string, tableNames?: string[]) => {
  const queryClient = useQueryClient();
  const [isPaused, setIsPaused] = useState(false);
  // What the page showed when paused, so the newest-row time matches the rows held still.
  const [heldTables, setHeldTables] = useState<ExperimentTableMetadata[] | undefined>();
  const [overdueAt, setOverdueAt] = useState(0);

  // An unattended page stops polling and catches up on the next input, since
  // re-enabling a query refetches stale data at once. A manual pause keeps the
  // query enabled so waking the page does not fetch behind it.
  const isIdle = useIsIdle();
  const isIdlePaused = isIdle && !isPaused;
  const isPolling = !isPaused && !isIdle;

  // A hidden tab stops polling: refetchIntervalInBackground stays off.
  const {
    data: tables,
    dataUpdatedAt,
    isFetching: isChecking,
    refetch,
  } = useQuery(
    orpc.experiments.getExperimentTables.queryOptions({
      input: { id: experimentId },
      enabled: !isIdlePaused,
      refetchInterval: isPolling ? POLL_MS : false,
      refetchOnWindowFocus: isPolling,
      staleTime: BACKEND_CACHE_MS,
    }),
  );

  // Other screens share the listing and may refetch it while this one is
  // paused, so a pause holds the rows still and resume applies what moved.
  const isLoadingRows =
    useIsFetching({
      queryKey: orpc.experiments.getExperimentData.key({ input: { id: experimentId } }),
    }) > 0;

  const seen = useRef<Map<string, ExperimentTableMetadata> | null>(null);
  useEffect(() => {
    if (!tables || isPaused) {
      return;
    }
    const previous = seen.current;
    seen.current = new Map(tables.map((table) => [table.identifier, table]));
    if (previous === null) {
      return;
    }

    for (const table of tables) {
      const before = previous.get(table.identifier);
      if (before !== undefined && versionOf(before) === versionOf(table)) {
        continue;
      }
      void queryClient.invalidateQueries({
        queryKey: orpc.experiments.getExperimentData.key({
          input: { id: experimentId, tableName: table.identifier },
        }),
      });

      const hasNewSchema = before?.schemaRevision !== table.schemaRevision;
      if (hasNewSchema) {
        void queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentTableColumns.key({
            input: { id: experimentId, tableName: table.identifier },
          }),
        });
      }
    }

    // A version counts as seen once polled, so rows whose refresh failed are
    // retried on every poll until they load, whether or not anything moved.
    void queryClient.refetchQueries({
      queryKey: orpc.experiments.getExperimentData.key({ input: { id: experimentId } }),
      type: "active",
      predicate: (query) => query.state.status === "error" && query.state.fetchStatus === "idle",
    });
    // An unchanged listing keeps its reference, so each poll is told apart by its time.
  }, [tables, dataUpdatedAt, isPaused, experimentId, queryClient]);

  useEffect(() => {
    if (!isPolling || dataUpdatedAt === 0) {
      return;
    }
    const timer = setTimeout(
      () => setOverdueAt(dataUpdatedAt),
      dataUpdatedAt + BEHIND_AFTER_MS - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [dataUpdatedAt, isPolling]);

  const togglePaused = () => {
    // Resuming catches up at once rather than on the next interval.
    if (isPaused) {
      void refetch();
    }
    setHeldTables(isPaused ? undefined : tables);
    setIsPaused(!isPaused);
  };

  const shownTables = isPaused ? (heldTables ?? tables) : tables;
  const isBehind = isPolling && dataUpdatedAt > 0 && overdueAt === dataUpdatedAt;
  const liveStatus: DataFreshnessStatus = isBehind ? "behind" : "live";
  const status: DataFreshnessStatus = isPolling ? liveStatus : "paused";

  return {
    hasLoaded: tables !== undefined,
    status,
    newestRowAt: shownTables ? newestOf(shownTables, tableNames) : null,
    refreshedAt: new Date(dataUpdatedAt),
    isChecking,
    isLoadingRows,
    isPaused,
    togglePaused,
  };
};
