import { getOrpcError, orpc, orpcClient } from "@/lib/orpc";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type {
  ExperimentTableMetadata,
  ExperimentTablesEvent,
  ExperimentTablesListing,
  ExperimentTableVersion,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

const RECONNECT_MS = 10_000;
const MAX_RECONNECT_MS = 2 * 60_000;
/** The backend sends a heartbeat every 20 s, so this long without one is a connection that died. */
const SILENT_AFTER_MS = 45_000;
/** Answers a retry would get again, so the page polls instead. */
const REFUSED_STATUSES = new Set([401, 403, 404]);

/** Whether a listing holds the change's tables, each under the name the store gives it. */
function covers(tables: ExperimentTableMetadata[], versions: ExperimentTableVersion[]) {
  const names = new Map(tables.map((table) => [table.identifier, table.displayName]));
  return (
    versions.length === names.size &&
    versions.every(
      ({ identifier, displayName }) =>
        names.has(identifier) && (displayName === null || names.get(identifier) === displayName),
    )
  );
}

function withVersions(
  listing: ExperimentTablesListing,
  versions: ExperimentTableVersion[],
): ExperimentTablesListing {
  const byIdentifier = new Map(versions.map((version) => [version.identifier, version]));
  return {
    ...listing,
    body: listing.body.map((table) => {
      const version = byIdentifier.get(table.identifier);
      if (version === undefined) {
        return table;
      }
      const { totalRows, latestRowAt, schemaRevision, contentRevision } = version;
      return { ...table, totalRows, latestRowAt, schemaRevision, contentRevision };
    }),
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const stop = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

/**
 * Listens until `signal` aborts, reconnecting with a growing, jittered wait after a stream that
 * ended, dropped or fell silent, and giving up on an answer a retry would get again.
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
    const connectedAt = Date.now();
    const connection = new AbortController();
    const hangUp = () => connection.abort();
    signal.addEventListener("abort", hangUp, { once: true });
    let silence = setTimeout(hangUp, SILENT_AFTER_MS);

    try {
      const events = await orpcClient.experiments.watchExperimentTables(
        { id: experimentId },
        { signal: connection.signal },
      );
      for await (const event of events) {
        // An event read before the page stopped listening can arrive after it did.
        if (isStopped()) {
          return;
        }
        clearTimeout(silence);
        silence = setTimeout(hangUp, SILENT_AFTER_MS);
        onEvent(event);
      }
    } catch (error) {
      const isRefused = REFUSED_STATUSES.has(getOrpcError(error)?.status ?? 0);
      if (isRefused) {
        if (!isStopped()) {
          onDrop();
        }
        return;
      }
    } finally {
      clearTimeout(silence);
      signal.removeEventListener("abort", hangUp);
    }
    if (isStopped()) {
      return;
    }

    // A stream that ends soon after it opens lengthens the wait though it sent events. One that held
    // past the longest wait, as one ending at its lifetime has, starts the wait over.
    const hasHeld = Date.now() - connectedAt >= MAX_RECONNECT_MS;
    if (hasHeld) {
      attempt = 0;
    }
    onDrop();
    const backoffMs = Math.min(RECONNECT_MS * 2 ** attempt, MAX_RECONNECT_MS);
    await sleep((0.5 + Math.random()) * backoffMs, signal);
    attempt += 1;
  }
}

/**
 * Follows the store's change stream of an experiment's tables while `isListening`, and writes each
 * change into the shared tables listing. `onOpenChange` hears whether the stream is connected;
 * `heardAt` is when it last said anything, a heartbeat included.
 */
export const useExperimentTableChanges = (
  experimentId: string,
  isListening: boolean,
  onOpenChange: (isOpen: boolean) => void,
) => {
  const queryClient = useQueryClient();
  const [heardAt, setHeardAt] = useState(0);

  useEffect(() => {
    if (!isListening) {
      return;
    }

    const listingKey = orpc.experiments.getExperimentTables.queryKey({
      input: { id: experimentId },
    });

    const controller = new AbortController();
    let connectedAt = 0;
    let isAwaitingFirstChange = false;
    // The newest change until a listing covers it, since a listing read under way would overwrite it.
    let pending: ExperimentTableVersion[] | undefined;

    const handleConnect = () => {
      connectedAt = Date.now();
      isAwaitingFirstChange = true;
    };

    // Table names come only from the listing, so each stream's first change waits for a listing
    // read since the stream was asked for. Says whether nothing is left pending.
    const applyPending = (): boolean => {
      if (pending === undefined) {
        return true;
      }

      const listed = queryClient.getQueryData(listingKey);
      // A store change never goes into a listing the warehouse answered; polling keeps that one.
      const isWarehouseListing = listed?.headers["x-data-source"] === "warehouse";
      if (isWarehouseListing) {
        pending = undefined;
        return true;
      }

      const listingState = queryClient.getQueryState(listingKey);
      const isListedSinceConnect =
        listingState !== undefined && listingState.dataUpdatedAt >= connectedAt;
      const needsNames = isAwaitingFirstChange && !isListedSinceConnect;
      const isCovered = !needsNames && listed !== undefined && covers(listed.body, pending);
      if (!isCovered) {
        return false;
      }

      queryClient.setQueryData(listingKey, withVersions(listed, pending));
      pending = undefined;
      isAwaitingFirstChange = false;
      return true;
    };

    // A read already under way when the change came may predate it, so one that leaves the change
    // pending is followed by a fresh read. What a fresh read leaves waits for the next heartbeat.
    const readListing = async (isJoining: boolean) => {
      await queryClient.refetchQueries(
        { queryKey: listingKey, exact: true },
        { cancelRefetch: false },
      );
      if (controller.signal.aborted) {
        return;
      }

      const isSettled = applyPending();
      if (!isSettled && isJoining) {
        void readListing(false);
      }
    };

    const handleEvent = (event: ExperimentTablesEvent) => {
      setHeardAt(Date.now());
      onOpenChange(true);

      if (event.type === "changed") {
        pending = event.tables;
      }
      if (pending === undefined) {
        return;
      }

      const isReading = queryClient.getQueryState(listingKey)?.fetchStatus === "fetching";
      if (!isReading && applyPending()) {
        return;
      }
      void readListing(isReading);
    };

    void followTableChanges(experimentId, controller.signal, {
      onConnect: handleConnect,
      onEvent: handleEvent,
      onDrop: () => onOpenChange(false),
    });
    return () => {
      controller.abort();
      onOpenChange(false);
    };
  }, [isListening, experimentId, queryClient, onOpenChange]);

  return { heardAt };
};
