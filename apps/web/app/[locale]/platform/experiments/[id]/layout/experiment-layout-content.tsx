"use client";

import { ExperimentLayoutViews } from "@/components/experiment-layout/experiment-layout-views";
import { LayoutSessionsSection } from "@/components/experiment-layout/layout-sessions-section";
import type { LayoutView } from "@/components/experiment-layout/layout-view";
import type { SessionsView } from "@/components/experiment-layout/sessions/sessions-view";
import { SESSIONS_VIEWS } from "@/components/experiment-layout/sessions/sessions-view";
import { PageContainer } from "@/components/page-container";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useSearchParams } from "next/navigation";
import { use } from "react";

import { useTranslation } from "@repo/i18n";

interface ExperimentLayoutContentProps {
  params: Promise<{ id: string }>;
}

// Scaffold: a `sessions` state opens the view it belongs to when the address names no view.
const VIEW_OF_SESSIONS_STATE: Record<SessionsView, LayoutView> = {
  "walking-order": "walking-order",
  "order-preview": "walking-order",
  divide: "walking-order",
  live: "field-days",
  overview: "field-days",
  review: "field-days",
};

export default function ExperimentLayoutContent({ params }: ExperimentLayoutContentProps) {
  const { id } = use(params);
  const { t } = useTranslation("experiments");
  const { data: accessData, isLoading, error } = useExperimentAccess(id);
  const sessionsState = useSearchParams().get("sessions");
  const sessionsView = SESSIONS_VIEWS.find((candidate) => candidate === sessionsState);

  const canEdit = Boolean(accessData?.hasAccess) && accessData?.experiment.status !== "archived";
  const sessions = <LayoutSessionsSection experimentId={id} canEdit={canEdit} />;

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={Boolean(accessData?.experiment)}
      loadingMessage={t("layout.loading")}
    >
      <PageContainer width="fluid" className="gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{t("layout.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("layout.description")}</p>
        </div>

        <ExperimentLayoutViews
          experimentId={id}
          canEdit={canEdit}
          walkingOrder={sessions}
          fieldDays={sessions}
          defaultView={sessionsView === undefined ? "plots" : VIEW_OF_SESSIONS_STATE[sessionsView]}
        />
      </PageContainer>
    </EntityLayoutShell>
  );
}
