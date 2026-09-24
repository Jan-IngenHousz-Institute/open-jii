import { orpc } from "@/lib/orpc";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";

const POLL_MS = 30_000;
/** The backend holds the listing this long, so an earlier refetch gets the same answer. */
const BACKEND_CACHE_MS = 15_000;
const BEHIND_AFTER_MS = 2 * 60_000;

export type DataFreshnessStatus = "live" | "paused" | "behind";

function newestOf(tables: ExperimentTableMetadata[], tableName: string | undefined): string | null {
  const times = tables
    .filter((table) => tableName === undefined || table.identifier === tableName)
    .flatMap((table) => (table.latestRowAt ? [table.latestRowAt] : []));
  return times.length > 0 ? times.reduce((a, b) => (a > b ? a : b)) : null;
}

function versionOf(table: ExperimentTableMetadata): string {
  return `${table.totalRows}|${table.latestRowAt}`;
}

/**
 * Polls the experiment's table listing while the page is visible and refetches
 * a table's rows and charts only when its count or newest row moves, so an
 * open page follows the pipeline without resetting what the user is doing.
 * `tableName` picks whose newest row to report; omitted, the whole experiment.
 */
export const useExperimentDataFreshness = (experimentId: string, tableName?: string) => {
  const queryClient = useQueryClient();
  const [isPaused, setIsPaused] = useState(false);
  const [overdueAt, setOverdueAt] = useState(0);

  // A hidden tab stops polling: refetchIntervalInBackground stays off.
  const {
    data: tables,
    dataUpdatedAt,
    isFetching: isChecking,
    refetch,
  } = useQuery(
    orpc.experiments.getExperimentTables.queryOptions({
      input: { id: experimentId },
      refetchInterval: isPaused ? false : POLL_MS,
      refetchOnWindowFocus: !isPaused,
      staleTime: BACKEND_CACHE_MS,
    }),
  );

  // Other screens share the listing and may refetch it while this one is
  // paused, so a pause holds the rows still and resume applies what moved.
  const isLoadingRows =
    useIsFetching({
      queryKey: orpc.experiments.getExperimentData.key({ input: { id: experimentId } }),
    }) > 0;

  const versions = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!tables || isPaused) {
      return;
    }
    const previous = versions.current;
    versions.current = new Map(tables.map((table) => [table.identifier, versionOf(table)]));
    if (previous === null) {
      return;
    }

    for (const table of tables) {
      if (previous.get(table.identifier) === versionOf(table)) {
        continue;
      }
      void queryClient.invalidateQueries({
        queryKey: orpc.experiments.getExperimentData.key({
          input: { id: experimentId, tableName: table.identifier },
        }),
      });
    }
  }, [tables, isPaused, experimentId, queryClient]);

  useEffect(() => {
    if (isPaused || dataUpdatedAt === 0) {
      return;
    }
    const timer = setTimeout(
      () => setOverdueAt(dataUpdatedAt),
      dataUpdatedAt + BEHIND_AFTER_MS - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [dataUpdatedAt, isPaused]);

  const togglePaused = () => {
    // Resuming catches up at once rather than on the next interval.
    if (isPaused) {
      void refetch();
    }
    setIsPaused(!isPaused);
  };

  const isBehind = !isPaused && dataUpdatedAt > 0 && overdueAt === dataUpdatedAt;
  const liveStatus: DataFreshnessStatus = isBehind ? "behind" : "live";
  const status: DataFreshnessStatus = isPaused ? "paused" : liveStatus;

  return {
    hasLoaded: tables !== undefined,
    status,
    newestRowAt: tables ? newestOf(tables, tableName) : null,
    refreshedAt: new Date(dataUpdatedAt),
    isChecking,
    isLoadingRows,
    isPaused,
    togglePaused,
  };
};
