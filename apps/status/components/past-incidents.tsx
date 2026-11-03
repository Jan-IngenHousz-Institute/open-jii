"use client";

import { useTranslation } from "@repo/i18n/client";
import type { Incident } from "@repo/monitoring/status-document";
import { Card } from "@repo/ui/components/card";

import { PastIncidentRow } from "./past-incident-row";
import { SectionTitle } from "./section-title";

function renderIncident(incident: Incident) {
  return <PastIncidentRow key={incident.id} incident={incident} />;
}

export function PastIncidents({ incidents }: { incidents: Incident[] }) {
  const { t } = useTranslation("status");

  return (
    <>
      <SectionTitle>{t("past.title")}</SectionTitle>
      <Card padding="none" className="gap-0">
        {incidents.length === 0 ? (
          <p className="text-muted-foreground px-6 py-4 text-sm">{t("past.empty")}</p>
        ) : (
          incidents.map(renderIncident)
        )}
      </Card>
    </>
  );
}
