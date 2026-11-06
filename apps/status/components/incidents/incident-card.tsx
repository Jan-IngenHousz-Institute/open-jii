"use client";

import { StatusBadge } from "~/components/shared/status-badge";
import { useFormat } from "~/hooks/use-format";
import { newestUpdatesFirst } from "~/lib/incidents";
import type { IncidentUpdateEntry } from "~/lib/incidents";

import { useTranslation } from "@repo/i18n/client";
import type { Incident } from "@repo/monitoring/status-document";
import { Card } from "@repo/ui/components/card";

import { IncidentUpdate } from "./incident-update";

export function IncidentCard({ incident }: { incident: Incident }) {
  const { t } = useTranslation("status");
  const format = useFormat();
  const components = format.names(incident.components.map((id) => t(`component.${id}.name`)));
  const started = t("incident.started", {
    date: format.weekdayDate(incident.startsAt),
    time: format.time(incident.startsAt),
  });

  function renderUpdate(update: IncidentUpdateEntry, index: number) {
    return <IncidentUpdate key={update.id} update={update} isLatest={index === 0} />;
  }

  return (
    <Card padding="none" className="gap-0 px-6 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge state={incident.impact} />
        <h2 className="font-semibold">{incident.title}</h2>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        {t("incident.affects", { components })} {started}
      </p>
      {newestUpdatesFirst(incident).map(renderUpdate)}
    </Card>
  );
}
