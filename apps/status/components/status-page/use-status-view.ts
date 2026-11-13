"use client";

import { useMemo } from "react";
import { useNow } from "~/hooks/use-now";
import { groupIncidents, isInProgress } from "~/lib/incidents";

import { STATUS_COMPONENT_IDS } from "@repo/monitoring/status-document";
import type { Incident, StatusComponent, StatusDocument } from "@repo/monitoring/status-document";

const STALE_AFTER_MS = 5 * 60_000;

type DeclaredState = Pick<StatusComponent, "id" | "state">;

const SEVERITY: Record<DeclaredState["state"], number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  outage: 3,
};

// The judge leaves out components that are not live yet, but an incident may still name them.
function declaredStates(started: Incident[], judged: StatusComponent[]): DeclaredState[] {
  const worst = new Map<StatusComponent["id"], DeclaredState["state"]>();

  for (const incident of started) {
    const state = incident.kind === "maintenance" ? "maintenance" : incident.impact;
    for (const id of incident.components) {
      const held = worst.get(id);
      const isJudged = judged.some((component) => component.id === id);
      if (!isJudged && (held === undefined || SEVERITY[state] > SEVERITY[held])) {
        worst.set(id, state);
      }
    }
  }

  return [...worst].map(([id, state]) => ({ id, state }));
}

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
  const startedIncidents = groups.open.filter((incident) => isInProgress(incident, now));
  const headlineComponents = [
    ...components,
    ...declaredStates([...startedIncidents, ...openWindows], components),
  ];
  const isAllOperational = headlineComponents.every(
    (component) => component.state === "operational",
  );

  return {
    now,
    groups,
    openWindows,
    components,
    headlineComponents,
    isStale,
    isAllOperational,
  };
}
