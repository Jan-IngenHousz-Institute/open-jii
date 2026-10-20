"use client";

import { ExperimentLayoutPanel } from "@/components/experiment-layout/experiment-layout-panel";
import { LayoutSessionsSection } from "@/components/experiment-layout/layout-sessions-section";
import { PageContainer } from "@/components/page-container";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { use } from "react";

import { useTranslation } from "@repo/i18n";

interface ExperimentLayoutContentProps {
  params: Promise<{ id: string }>;
}

export default function ExperimentLayoutContent({ params }: ExperimentLayoutContentProps) {
  const { id } = use(params);
  const { t } = useTranslation("experiments");
  const { data: accessData, isLoading, error } = useExperimentAccess(id);

  const canEdit = Boolean(accessData?.hasAccess) && accessData?.experiment.status !== "archived";

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

        <ExperimentLayoutPanel experimentId={id} canEdit={canEdit} />
        <LayoutSessionsSection experimentId={id} canEdit={canEdit} />
      </PageContainer>
    </EntityLayoutShell>
  );
}
