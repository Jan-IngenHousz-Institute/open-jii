"use client";

import { StatusBadge } from "~/components/shared/status-badge";
import { useFormat } from "~/hooks/use-format";
import { newestUpdatesFirst } from "~/lib/incidents";

import type { Incident } from "@repo/monitoring/status-document";

export function PastIncidentRow({ incident }: { incident: Incident }) {
  const format = useFormat();
  const latest = newestUpdatesFirst(incident).at(0);

  return (
    <div className="border-border grid gap-3 border-t px-6 py-4 first:border-t-0 md:grid-cols-[9rem_1fr]">
      <p className="text-sm font-semibold">{format.shortDate(incident.startsAt)}</p>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge state={incident.kind === "maintenance" ? "completed" : "resolved"} />
          <h3 className="font-semibold">{incident.title}</h3>
        </div>
        {latest === undefined ? null : (
          <p className="text-muted-foreground mt-1 text-sm">{latest.text}</p>
        )}
      </div>
    </div>
  );
}
