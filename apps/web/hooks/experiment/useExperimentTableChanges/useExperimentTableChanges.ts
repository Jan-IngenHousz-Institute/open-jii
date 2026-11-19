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
/** Answers a retry would get again, so the page polls instead. */
const REFUSED_STATUSES = new Set([401, 403, 404]);

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
 * Follows the store's change stream of an experiment's tables while `isListening`, and writes each
 * change into the shared tables listing. `heardAt` is when the stream last said anything, a
 * heartbeat included; `isOpen` says whether it is connected now.
 */
export const useExperimentTableChanges = (experimentId: string, isListening: boolean) => {
  const queryClient = useQueryClient();
  const [heardAt, setHeardAt] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

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
      setHeardAt(Date.now());
      setIsOpen(true);

      if (event.type === "heartbeat") {
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
      void queryClient.refetchQueries(
        { queryKey: listingKey, exact: true },
        { cancelRefetch: false },
      );
    };

    const controller = new AbortController();
    void followTableChanges(experimentId, controller.signal, {
      onConnect: handleConnect,
      onEvent: handleEvent,
      onDrop: () => setIsOpen(false),
    });
    return () => {
      controller.abort();
      setIsOpen(false);
    };
  }, [isListening, experimentId, queryClient]);

  return { heardAt, isOpen: isListening && isOpen };
};
