"use client";

import { ComponentsSection } from "~/components/component-list/components-section";
import { HowWeMeasure } from "~/components/component-list/how-we-measure";
import { FreshnessLine } from "~/components/headline/freshness-line";
import { StatusHeadline } from "~/components/headline/status-headline";
import { IncidentCard } from "~/components/incidents/incident-card";
import { MaintenanceCard } from "~/components/incidents/maintenance-card";
import { NoticeBanner } from "~/components/incidents/notice-banner";
import { PastIncidents } from "~/components/incidents/past-incidents";

import type { Incident, StatusDocument } from "@repo/monitoring/status-document";

import { StatusTitle } from "./status-title";
import { useStatusView } from "./use-status-view";

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
  const { now, groups, openWindows, components, isStale, isAllOperational } = useStatusView(
    document,
    serverOffsetMs,
  );

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
        generatedAt={document.generatedAt}
        isStale={isStale}
      />

      <HowWeMeasure />
      <PastIncidents incidents={groups.past} />
    </>
  );
}
