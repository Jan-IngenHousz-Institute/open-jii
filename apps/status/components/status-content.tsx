"use client";

import { useMemo } from "react";
import { useNow } from "~/hooks/use-now";
import { groupIncidents, isInProgress } from "~/lib/incidents";

import { STATUS_COMPONENT_IDS } from "@repo/monitoring/status-document";
import type { Incident, StatusDocument } from "@repo/monitoring/status-document";

import { ComponentsSection } from "./components-section";
import { FreshnessLine } from "./freshness-line";
import { HowWeMeasure } from "./how-we-measure";
import { IncidentCard } from "./incident-card";
import { MaintenanceCard } from "./maintenance-card";
import { NoticeBanner } from "./notice-banner";
import { PastIncidents } from "./past-incidents";
import { StatusHeadline } from "./status-headline";
import { StatusTitle } from "./status-title";

const STALE_AFTER_MS = 5 * 60_000;

type Notice = StatusDocument["notices"][number];

interface StatusContentProps {
  document: StatusDocument;
  serverOffsetMs: number;
  hasRefreshFailed: boolean;
}

function renderNotice(notice: Notice) {
  return <NoticeBanner key={notice.id} notice={notice} />;
}

function renderIncident(incident: Incident) {
  return <IncidentCard key={incident.id} incident={incident} />;
}

export function StatusContent({ document, serverOffsetMs, hasRefreshFailed }: StatusContentProps) {
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
  const hasExtras = isAllOperational && !isStale;

  function renderWindow(maintenance: Incident) {
    return <MaintenanceCard key={maintenance.id} incident={maintenance} now={now} />;
  }

  return (
    <>
      <StatusTitle>
        <FreshnessLine
          generatedAt={document.generatedAt}
          now={now}
          isStale={isStale}
          hasRefreshFailed={hasRefreshFailed}
        />
      </StatusTitle>

      {document.notices.map(renderNotice)}

      <StatusHeadline
        components={components}
        openWindows={openWindows}
        generatedAt={document.generatedAt}
        isStale={isStale}
        isAllOperational={isAllOperational}
      />

      {groups.open.map(renderIncident)}
      {groups.planned.map(renderWindow)}

      <ComponentsSection
        components={components}
        incidents={document.incidents}
        today={document.generatedAt.slice(0, 10)}
        messagesPerMinute={document.messagesPerMinute}
        hasExtras={hasExtras}
        isStale={isStale}
      />

      <HowWeMeasure />
      <PastIncidents incidents={groups.past} />
    </>
  );
}
