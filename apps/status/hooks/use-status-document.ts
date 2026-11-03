"use client";

import { useEffect, useState } from "react";

import { readableStatusDocumentSchema } from "@repo/monitoring/status-document";
import type { StatusDocument } from "@repo/monitoring/status-document";

const STATUS_URL = "/data/status.json";
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

async function fetchDocument(signal: AbortSignal): Promise<Fetched> {
  const response = await fetch(STATUS_URL, { cache: "no-store", signal });
  const receivedAt = Date.now();

  if (!response.ok) {
    throw new Error(`${STATUS_URL} answered ${response.status}`);
  }

  return {
    document: readableStatusDocumentSchema.parse(await response.json()),
    serverOffsetMs: offsetFrom(response.headers, receivedAt),
  };
}

function isNewer(fetched: StatusDocument, held: StatusDocument) {
  return Date.parse(fetched.generatedAt) > Date.parse(held.generatedAt);
}

// A failed refresh keeps the last good document, which is judged stale on the server's clock.
export function useStatusDocument() {
  const [current, setCurrent] = useState<StatusDocument>();
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    function accept(fetched: Fetched) {
      setCurrent((held) =>
        held === undefined || isNewer(fetched.document, held) ? fetched.document : held,
      );
      if (fetched.serverOffsetMs !== undefined) {
        setServerOffsetMs(fetched.serverOffsetMs);
      }
      setHasFailed(false);
    }

    // One controller per request rather than AbortSignal.any, which older phones' browsers lack.
    function refresh() {
      const request = new AbortController();
      const timeout = window.setTimeout(() => request.abort(), FETCH_TIMEOUT_MS);
      controller.signal.addEventListener("abort", () => request.abort(), { once: true });

      fetchDocument(request.signal)
        .then(accept)
        .catch(() => {
          if (!controller.signal.aborted) {
            setHasFailed(true);
          }
        })
        .finally(() => window.clearTimeout(timeout));
    }

    function refreshWhenVisible() {
      if (window.document.visibilityState === "visible") {
        refresh();
      }
    }

    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refresh);

    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refresh);
    };
  }, []);

  return { document: current, serverOffsetMs, hasFailed };
}
