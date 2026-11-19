import { useExperimentTableChanges } from "@/hooks/experiment/useExperimentTableChanges/useExperimentTableChanges";
import { useIsIdle } from "@/hooks/useIsIdle";
import { orpc } from "@/lib/orpc";
import { focusManager, useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type {
  ExperimentTableMetadata,
  ExperimentTableVersion,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

const POLL_MS = 30_000;
/** The backend holds a warehouse listing this long, so an earlier refetch gets the same answer. */
const BACKEND_CACHE_MS = 15_000;
const BEHIND_AFTER_MS = 2 * 60_000;
/** Keeps a page under steady ingest inside the backend's per-address request limit. */
const REFRESH_GAP_MS = 5_000;

export type DataFreshnessStatus = "live" | "paused" | "behind";

interface RefreshedTable {
  table: ExperimentTableMetadata;
  at: number;
}

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

function refreshTable(
  queryClient: QueryClient,
  experimentId: string,
  table: ExperimentTableMetadata,
  before: ExperimentTableMetadata | undefined,
): void {
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

function retryFailedRows(queryClient: QueryClient, experimentId: string): void {
  void queryClient.refetchQueries({
    queryKey: orpc.experiments.getExperimentData.key({ input: { id: experimentId } }),
    type: "active",
    predicate: (query) => query.state.status === "error" && query.state.fetchStatus === "idle",
  });
}

function subscribeToFocus(onChange: () => void): () => void {
  return focusManager.subscribe(onChange);
}

function isFocused(): boolean {
  return focusManager.isFocused();
}

/**
 * Follows the experiment's table listing while the page is visible and in use, and
 * refetches a table's rows and charts only when its count, newest row or schema
 * moves, and its columns only when its schema does, so an open page follows the
 * pipeline without resetting what the user is doing. A listing the store answered
 * is followed through the store's change stream, one from the warehouse by polling.
 * `tableNames` picks whose newest data to report; omitted, the whole experiment.
 */
export const useExperimentDataFreshness = (experimentId: string, tableNames?: string[]) => {
  const queryClient = useQueryClient();
  const [isPaused, setIsPaused] = useState(false);
  const [isStreamOpen, setIsStreamOpen] = useState(false);
  // What the page showed when paused, so the newest-row time matches the rows held still.
  const [heldTables, setHeldTables] = useState<ExperimentTableMetadata[] | undefined>();
  const [overdueAt, setOverdueAt] = useState(0);

  // An unattended page stops polling and catches up on the next input, since
  // re-enabling a query refetches stale data at once. A manual pause keeps the
  // query enabled so waking the page does not fetch behind it.
  const isIdle = useIsIdle();
  const isIdlePaused = isIdle && !isPaused;
  const isPolling = !isPaused && !isIdle;
  const isPollingListing = isPolling && !isStreamOpen;

  // A hidden tab stops polling, as refetchIntervalInBackground stays off, and closes the stream.
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

  const isVisible = useSyncExternalStore(subscribeToFocus, isFocused, () => true);
  const isStoreListing = listing?.headers["x-data-source"] === "store";
  const isListening = isPolling && isVisible && isStoreListing;
  const stream = useExperimentTableChanges(experimentId, isListening, setIsStreamOpen);

  // Other screens share the listing and may refetch it while this one is
  // paused, so a pause holds the rows still and resume applies what moved.
  const isLoadingRows =
    useIsFetching({
      queryKey: orpc.experiments.getExperimentData.key({ input: { id: experimentId } }),
    }) > 0;

  const refreshed = useRef<Map<string, RefreshedTable> | null>(null);
  useEffect(() => {
    if (!tables || isPaused) {
      return;
    }
    const refreshedTables = refreshed.current;
    if (refreshedTables === null) {
      refreshed.current = new Map(tables.map((table) => [table.identifier, { table, at: 0 }]));
      return;
    }

    const refresh = (table: ExperimentTableMetadata) => {
      refreshTable(queryClient, experimentId, table, refreshedTables.get(table.identifier)?.table);
      refreshedTables.set(table.identifier, { table, at: Date.now() });
    };

    // A change inside the gap is held to its end rather than dropped, so a burst's last one lands.
    const held: ReturnType<typeof setTimeout>[] = [];
    for (const table of tables) {
      const last = refreshedTables.get(table.identifier);
      const hasMoved = last === undefined || versionOf(last.table) !== versionOf(table);
      if (!hasMoved) {
        continue;
      }

      const waitMs = (last?.at ?? 0) + REFRESH_GAP_MS - Date.now();
      const isTooSoon = waitMs > 0;
      if (isTooSoon) {
        held.push(setTimeout(() => refresh(table), waitMs));
      } else {
        refresh(table);
      }
    }

    // A version counts as refreshed once asked for, so rows whose refresh failed are retried
    // at every poll and stream event until they load, whether or not anything moved.
    retryFailedRows(queryClient, experimentId);
    return () => held.forEach((timer) => clearTimeout(timer));
    // An unchanged listing keeps its reference, so each poll is told apart by its time.
  }, [tables, dataUpdatedAt, isPaused, experimentId, queryClient]);

  // A heartbeat moves nothing, so rows whose refresh failed are retried on it too.
  useEffect(() => {
    if (stream.heardAt > 0) {
      retryFailedRows(queryClient, experimentId);
    }
  }, [stream.heardAt, queryClient, experimentId]);

  const heardAt = Math.max(dataUpdatedAt, stream.heardAt);
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
