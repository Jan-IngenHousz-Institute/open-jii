"use client";

import { useFormat } from "~/hooks/use-format";
import { isInProgress, newestUpdatesFirst } from "~/lib/incidents";

import { useTranslation } from "@repo/i18n/client";
import type { Incident } from "@repo/monitoring/status-document";
import { Card } from "@repo/ui/components/card";

import { StatusBadge } from "./status-badge";

interface MaintenanceCardProps {
  incident: Incident;
  now: number;
}

export function MaintenanceCard({ incident, now }: MaintenanceCardProps) {
  const { t } = useTranslation("status");
  const format = useFormat();
  const hasStarted = isInProgress(incident, now);
  const components = format.names(incident.components.map((id) => t(`component.${id}.name`)));
  const latest = newestUpdatesFirst(incident).at(0);

  function describeWindow() {
    const { startsAt, endsAt } = incident;

    if (endsAt === undefined) {
      return t("maintenance.windowOpenEnded", { from: format.dateTime(startsAt) });
    }

    const isSingleDay = startsAt.slice(0, 10) === endsAt.slice(0, 10);

    return isSingleDay
      ? t("maintenance.windowSameDay", {
          date: format.weekdayDate(startsAt),
          from: format.time(startsAt),
          to: format.time(endsAt),
        })
      : t("maintenance.windowSpansDays", {
          from: format.dateTime(startsAt),
          to: format.dateTime(endsAt),
        });
  }

  return (
    <Card padding="none" className="gap-0 px-6 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge state={hasStarted ? "in-progress" : "scheduled"} />
        <h2 className="font-semibold">{incident.title}</h2>
      </div>
      <p className="mt-1 text-sm font-medium">{describeWindow()}</p>
      {latest === undefined ? null : (
        <p className="text-muted-foreground mt-1 text-sm">{latest.text}</p>
      )}
      <p className="text-muted-foreground mt-1 text-sm">{t("incident.affects", { components })}</p>
    </Card>
  );
}
