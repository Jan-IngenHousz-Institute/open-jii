import { useIsIdle } from "@/hooks/useIsIdle";
import { getOrpcError, orpc, orpcClient } from "@/lib/orpc";
import { focusManager, useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type {
  ExperimentDataSource,
  ExperimentTableMetadata,
  ExperimentTablesEvent,
  ExperimentTablesListing,
  ExperimentTableVersion,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

const POLL_MS = 30_000;
/** The backend holds a warehouse listing this long, so an earlier refetch gets the same answer. */
const BACKEND_CACHE_MS = 15_000;
const BEHIND_AFTER_MS = 2 * 60_000;
const RECONNECT_MS = 10_000;
const MAX_RECONNECT_MS = 2 * 60_000;
/** Answers a retry would get again, so the page polls instead. */
const REFUSED_STATUSES = new Set([401, 403, 404]);

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

function isSameTableSet(tables: ExperimentTableMetadata[], versions: ExperimentTableVersion[]) {
  const identifiers = new Set(tables.map((table) => table.identifier));
  return (
    versions.length === identifiers.size &&
    versions.every((version) => identifiers.has(version.identifier))
  );
}

function withVersions(
  listing: ExperimentTablesListing,
  versions: ExperimentTableVersion[],
): ExperimentTablesListing {
  const byIdentifier = new Map(versions.map((version) => [version.identifier, version]));
  return {
    ...listing,
    body: listing.body.map((table) => ({ ...table, ...byIdentifier.get(table.identifier) })),
  };
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

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Listens until `signal` aborts, reconnecting with a growing, jittered wait after a stream that
 * ended or dropped, and giving up on an answer a retry would get again.
 */
async function followTableChanges(
  experimentId: string,
  signal: AbortSignal,
  handlers: {
    onConnect: () => void;
    onEvent: (event: ExperimentTablesEvent) => void;
    onDrop: () => void;
  },
): Promise<void> {
  const { onConnect, onEvent, onDrop } = handlers;
  let attempt = 0;
  // Read through a call, since the stream's awaits can abort the signal between two reads.
  const isStopped = () => signal.aborted;

  while (!isStopped()) {
    onConnect();
    try {
      const events = await orpcClient.experiments.watchExperimentTables(
        { id: experimentId },
        { signal },
      );
      for await (const event of events) {
        attempt = 0;
        onEvent(event);
      }
    } catch (error) {
      const isRefused = REFUSED_STATUSES.has(getOrpcError(error)?.status ?? 0);
      if (isRefused) {
        onDrop();
        return;
      }
    }
    if (isStopped()) {
      return;
    }

    onDrop();
    const backoffMs = Math.min(RECONNECT_MS * 2 ** attempt, MAX_RECONNECT_MS);
    await sleep((0.5 + Math.random()) * backoffMs, signal);
    attempt += 1;
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
  const [isStreamOpen, setIsStreamOpen] = useState(false);

  // An unattended page stops polling and catches up on the next input, since
  // re-enabling a query refetches stale data at once. A manual pause keeps the
  // query enabled so waking the page does not fetch behind it.
  const isIdle = useIsIdle();
  const isIdlePaused = isIdle && !isPaused;
  const isPolling = !isPaused && !isIdle;
  const isVisible = useSyncExternalStore(subscribeToFocus, isFocused, () => true);
  const isListening = isPolling && isVisible && rowsSource === "store";
  const isStreamLive = isListening && isStreamOpen;
  const isPollingListing = isPolling && !isStreamLive;

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

    // A version counts as seen once listed, so rows whose refresh failed are retried at
    // every poll and stream event until they load, whether or not anything moved.
    retryFailedRows(queryClient, experimentId);
    // An unchanged listing keeps its reference, so each poll is told apart by its time.
  }, [tables, dataUpdatedAt, isPaused, experimentId, queryClient]);

  useEffect(() => {
    if (!isListening) {
      return;
    }

    const listingKey = orpc.experiments.getExperimentTables.queryKey({
      input: { id: experimentId },
    });

    let connectedAt = 0;
    let isAwaitingFirstChange = false;

    const handleConnect = () => {
      connectedAt = Date.now();
      isAwaitingFirstChange = true;
    };

    const handleEvent = (event: ExperimentTablesEvent) => {
      setStreamHeardAt(Date.now());
      setIsStreamOpen(true);

      if (event.type === "heartbeat") {
        retryFailedRows(queryClient, experimentId);
        return;
      }

      // Table names come only from the listing, so each stream reads it once unless a catch-up
      // already has since the stream was asked for.
      const listingState = queryClient.getQueryState(listingKey);
      const isListedSinceConnect =
        listingState !== undefined &&
        (listingState.dataUpdatedAt >= connectedAt || listingState.fetchStatus === "fetching");
      const needsNames = isAwaitingFirstChange && !isListedSinceConnect;
      isAwaitingFirstChange = false;

      const listed = queryClient.getQueryData(listingKey);
      const canApply =
        !needsNames && listed !== undefined && isSameTableSet(listed.body, event.tables);
      if (canApply) {
        queryClient.setQueryData(listingKey, withVersions(listed, event.tables));
        return;
      }

      // Joins a catch-up already loading.
      void refetch({ cancelRefetch: false });
    };

    const controller = new AbortController();
    void followTableChanges(experimentId, controller.signal, {
      onConnect: handleConnect,
      onEvent: handleEvent,
      onDrop: () => setIsStreamOpen(false),
    });
    return () => {
      controller.abort();
      setIsStreamOpen(false);
    };
  }, [isListening, experimentId, queryClient, refetch]);

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
