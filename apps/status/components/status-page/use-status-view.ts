"use client";

import { useMemo } from "react";
import { useNow } from "~/hooks/use-now";
import { groupIncidents, isInProgress } from "~/lib/incidents";

import { STATUS_COMPONENT_IDS } from "@repo/monitoring/status-document";
import type { StatusDocument } from "@repo/monitoring/status-document";

const STALE_AFTER_MS = 5 * 60_000;

// Everything the page derives from one document on the server's clock.
export function useStatusView(document: StatusDocument, serverOffsetMs: number) {
  const now = useNow(serverOffsetMs);
  const groups = groupIncidents(document.incidents, now);
  const openWindows = groups.planned.filter((maintenance) => isInProgress(maintenance, now));
  const components = useMemo(
    () =>
      STATUS_COMPONENT_IDS.flatMap((id) =>
        document.components.filter((component) => component.id === id),
      ),
    [document.components],
  );
  const isStale = now - Date.parse(document.generatedAt) > STALE_AFTER_MS;
  const isAllOperational = components.every((component) => component.state === "operational");

  return {
    now,
    groups,
    openWindows,
    components,
    isStale,
    isAllOperational,
    hasExtras: isAllOperational && !isStale,
  };
}
