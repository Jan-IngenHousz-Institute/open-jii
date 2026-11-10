"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { readableStatusDocumentSchema } from "@repo/monitoring/status-document";
import type { StatusDocument } from "@repo/monitoring/status-document";

const STATUS_URL = "/data/status.json";
const STATUS_QUERY_KEY = ["status-document"];
const REFRESH_MS = 60_000;
const FETCH_TIMEOUT_MS = 10_000;

interface Fetched {
  document: StatusDocument;
  serverOffsetMs: number | undefined;
}

// A response from the CDN's cache carries the origin's Date plus its Age since then.
function offsetFrom(headers: Headers, receivedAt: number) {
  const dateHeader = headers.get("Date");
  const serverTime = dateHeader === null ? Number.NaN : Date.parse(dateHeader);
  const ageSeconds = Number(headers.get("Age") ?? 0);
  const ageMs = Number.isFinite(ageSeconds) ? ageSeconds * 1000 : 0;

  return Number.isNaN(serverTime) ? undefined : serverTime + ageMs - receivedAt;
}

// One controller per request rather than AbortSignal.any, which older phones' browsers lack.
async function fetchDocument(signal: AbortSignal): Promise<Fetched> {
  const request = new AbortController();
  const timeout = window.setTimeout(() => request.abort(), FETCH_TIMEOUT_MS);
  signal.addEventListener("abort", () => request.abort(), { once: true });

  try {
    const response = await fetch(STATUS_URL, { cache: "no-store", signal: request.signal });
    const receivedAt = Date.now();

    if (!response.ok) {
      throw new Error(`${STATUS_URL} answered ${response.status}`);
    }

    return {
      document: readableStatusDocumentSchema.parse(await response.json()),
      serverOffsetMs: offsetFrom(response.headers, receivedAt),
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function isNewer(fetched: StatusDocument, held: StatusDocument) {
  return Date.parse(fetched.generatedAt) > Date.parse(held.generatedAt);
}

// A failed refresh keeps the last good document, which is judged stale on the server's clock.
export function useStatusDocument() {
  const queryClient = useQueryClient();

  // A CDN edge can still answer with an older copy, so a refresh never replaces a newer document.
  async function fetchNewest({ signal }: { signal: AbortSignal }): Promise<Fetched> {
    const fetched = await fetchDocument(signal);
    const held = queryClient.getQueryData<Fetched>(STATUS_QUERY_KEY);
    const serverOffsetMs = fetched.serverOffsetMs ?? held?.serverOffsetMs;

    if (held === undefined || isNewer(fetched.document, held.document)) {
      return { document: fetched.document, serverOffsetMs };
    }

    return { document: held.document, serverOffsetMs };
  }

  const { data, isError } = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: fetchNewest,
    refetchInterval: REFRESH_MS,
    retry: false,
    // Offline, a refresh fails and says so, rather than pausing until the network returns.
    networkMode: "always",
    // That mode turns the refresh on reconnecting off by default.
    refetchOnReconnect: true,
  });

  return {
    document: data?.document,
    serverOffsetMs: data?.serverOffsetMs ?? 0,
    hasFailed: isError,
  };
}
