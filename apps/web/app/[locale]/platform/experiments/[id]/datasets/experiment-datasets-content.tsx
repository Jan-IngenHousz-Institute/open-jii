"use client";

import { ExperimentDatasetsPanel } from "@/components/datasets/experiment-datasets-panel";
import { PageContainer } from "@/components/page-container";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { use } from "react";

import { useTranslation } from "@repo/i18n";

interface ExperimentDatasetsContentProps {
  params: Promise<{ id: string }>;
}

export default function ExperimentDatasetsContent({ params }: ExperimentDatasetsContentProps) {
  const { id } = use(params);
  const { t } = useTranslation("datasets");
  const { data: accessData, isLoading, error } = useExperimentAccess(id);

  // An archived experiment accepts no other change, so it publishes no dataset either.
  const canPublish = Boolean(accessData?.hasAccess) && accessData?.experiment.status !== "archived";

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={Boolean(accessData?.experiment)}
      loadingMessage={t("tab.loading")}
    >
      <PageContainer width="fluid" className="gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{t("tab.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("tab.description")}</p>
        </div>

        <ExperimentDatasetsPanel experimentId={id} canPublish={canPublish} />
      </PageContainer>
    </EntityLayoutShell>
  );
}
