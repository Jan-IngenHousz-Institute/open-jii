import { useIsIdle } from "@/hooks/useIsIdle";
import { orpc, orpcClient } from "@/lib/orpc";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type {
  ExperimentDataSource,
  ExperimentTableMetadata,
  ExperimentTablesEvent,
  ExperimentTableVersion,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

const POLL_MS = 30_000;
const RECONNECT_MS = 10_000;
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

function versionOf(table: ExperimentTableVersion): string {
  return `${table.totalRows}|${table.latestRowAt}|${table.schemaRevision}`;
}

function hasMoved(
  seen: Map<string, ExperimentTableMetadata> | null,
  tables: ExperimentTableVersion[],
): boolean {
  if (seen?.size !== tables.length) {
    return true;
  }
  return tables.some((table) => {
    const before = seen.get(table.identifier);
    return before === undefined || versionOf(before) !== versionOf(table);
  });
}

/** Listens until `signal` aborts, reconnecting after a stream that dropped. */
async function followTableChanges(
  experimentId: string,
  signal: AbortSignal,
  onEvent: (event: ExperimentTablesEvent) => void,
  onDrop: () => void,
): Promise<void> {
  while (!signal.aborted) {
    try {
      const events = await orpcClient.experiments.watchExperimentTables(
        { id: experimentId },
        { signal },
      );
      for await (const event of events) {
        onEvent(event);
      }
    } catch {
      // The listing is checked every 30 seconds until the stream is back.
    }

    onDrop();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, RECONNECT_MS);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve(undefined);
        },
        { once: true },
      );
    });
  }
}

/**
 * Follows the experiment's table listing while the page is visible and in use, and
 * refetches a table's rows and charts only when its count, newest row or schema
 * moves, and its columns only when its schema does, so an open page follows the
 * pipeline without resetting what the user is doing. Rows read from the store are
 * followed through its change stream, others by polling. `tableNames` picks whose
 * newest data to report; omitted, the whole experiment.
 */
export const useExperimentDataFreshness = (
  experimentId: string,
  rowsSource: ExperimentDataSource | undefined,
  tableNames?: string[],
) => {
  const queryClient = useQueryClient();
  const [isPaused, setIsPaused] = useState(false);
  // What the page showed when paused, so the newest-row time matches the rows held still.
  const [heldTables, setHeldTables] = useState<ExperimentTableMetadata[] | undefined>();
  const [overdueAt, setOverdueAt] = useState(0);
  const [streamHeardAt, setStreamHeardAt] = useState(0);

  // An unattended page stops polling and catches up on the next input, since
  // re-enabling a query refetches stale data at once. A manual pause keeps the
  // query enabled so waking the page does not fetch behind it.
  const isIdle = useIsIdle();
  const isIdlePaused = isIdle && !isPaused;
  const isPolling = !isPaused && !isIdle;
  const isListening = isPolling && rowsSource === "store";
  const isStreamLive = isListening && streamHeardAt > 0;
  const isPollingListing = isPolling && !isStreamLive;

  // A hidden tab stops polling: refetchIntervalInBackground stays off.
  const {
    data: listing,
    dataUpdatedAt,
    isFetching: isChecking,
    refetch,
  } = useQuery(
    orpc.experiments.getExperimentTables.queryOptions({
      input: { id: experimentId },
      enabled: !isIdlePaused,
      refetchInterval: isPollingListing ? POLL_MS : false,
      refetchOnWindowFocus: isPollingListing,
      staleTime: BACKEND_CACHE_MS,
    }),
  );
  const tables = listing?.body;

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

      void queryClient.invalidateQueries({
        queryKey: orpc.experiments.getExperimentData.key({ input: { id: experimentId } }),
        predicate: (query) => query.meta?.secondaryTableName === table.identifier,
      });

      const hasNewSchema = before?.schemaRevision !== table.schemaRevision;
      if (hasNewSchema) {
        void queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentTableColumns.key({
            input: { id: experimentId, tableName: table.identifier },
          }),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentTableColumns.key({ input: { id: experimentId } }),
          predicate: (query) => query.meta?.secondaryTableName === table.identifier,
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
    if (!isListening) {
      return;
    }

    // Joins a catch-up already loading, so reopening the stream fetches the listing once.
    const handleEvent = (event: ExperimentTablesEvent) => {
      setStreamHeardAt(Date.now());
      if (event.type === "changed" && hasMoved(seen.current, event.tables)) {
        void refetch({ cancelRefetch: false });
      }
    };

    const controller = new AbortController();
    void followTableChanges(experimentId, controller.signal, handleEvent, () =>
      setStreamHeardAt(0),
    );
    return () => controller.abort();
  }, [isListening, experimentId, refetch]);

  const heardAt = Math.max(dataUpdatedAt, streamHeardAt);
  useEffect(() => {
    if (!isPolling || heardAt === 0) {
      return;
    }
    const timer = setTimeout(() => setOverdueAt(heardAt), heardAt + BEHIND_AFTER_MS - Date.now());
    return () => clearTimeout(timer);
  }, [heardAt, isPolling]);

  const togglePaused = () => {
    // Resuming catches up at once rather than on the next interval.
    if (isPaused) {
      void refetch();
    }
    setHeldTables(isPaused ? undefined : tables);
    setIsPaused(!isPaused);
  };

  const shownTables = isPaused ? (heldTables ?? tables) : tables;
  const isBehind = isPolling && heardAt > 0 && overdueAt === heardAt;
  const liveStatus: DataFreshnessStatus = isBehind ? "behind" : "live";
  const status: DataFreshnessStatus = isPolling ? liveStatus : "paused";

  return {
    hasLoaded: tables !== undefined,
    status,
    newestRowAt: shownTables ? newestOf(shownTables, tableNames) : null,
    refreshedAt: new Date(heardAt),
    isChecking,
    isLoadingRows,
    isPaused,
    togglePaused,
  };
};
