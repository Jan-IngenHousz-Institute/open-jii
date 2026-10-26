"use client";

import { ExperimentDatasetsPanel } from "@/components/datasets/experiment-datasets-panel";
import { StandardsStepsBlock } from "@/components/experiment-standards/standards-steps-block";
import { PageContainer } from "@/components/page-container";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useSearchParams } from "next/navigation";
import { use } from "react";

import { useTranslation } from "@repo/i18n";

interface ExperimentDatasetsContentProps {
  params: Promise<{ id: string }>;
}

export default function ExperimentDatasetsContent({ params }: ExperimentDatasetsContentProps) {
  const { id } = use(params);
  const { t } = useTranslation("datasets");
  const { data: accessData, isLoading, error } = useExperimentAccess(id);

  // An archived experiment still publishes, so data from a finished study can be cited.
  const canPublish = Boolean(accessData?.capabilities.canUpdate);
  // Withdrawing is still possible on an archived experiment, since its datasets stay public.
  const canManage = Boolean(accessData?.isAdmin);
  // Scaffold: ?standards=off shows the tab as it is before the standards block ships.
  const showsStandards = useSearchParams().get("standards") !== "off";

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

        {showsStandards ? <StandardsStepsBlock experimentId={id} canPublish={canPublish} /> : null}

        <ExperimentDatasetsPanel
          experimentId={id}
          canPublish={canPublish}
          canManage={canManage}
          showsPublishButton={!showsStandards}
        />
      </PageContainer>
    </EntityLayoutShell>
  );
}
