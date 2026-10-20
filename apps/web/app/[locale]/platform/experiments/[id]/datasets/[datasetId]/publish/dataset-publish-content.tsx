"use client";

import { DatasetPublishFlow } from "@/components/datasets/publish/dataset-publish-flow";
import { PageContainer } from "@/components/page-container";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useDataset } from "@/hooks/dataset/useDataset/useDataset";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { use } from "react";

import { useTranslation } from "@repo/i18n";

interface DatasetPublishContentProps {
  params: Promise<{ id: string; datasetId: string }>;
}

export default function DatasetPublishContent({ params }: DatasetPublishContentProps) {
  const { id, datasetId } = use(params);
  const { t } = useTranslation("datasets");
  const access = useExperimentAccess(id);
  const draft = useDataset(datasetId);

  const experiment = access.data?.experiment;
  const dataset = draft.data;

  return (
    <EntityLayoutShell
      isLoading={access.isLoading || draft.isLoading}
      error={access.error ?? draft.error}
      hasData={experiment !== undefined && dataset !== undefined}
      loadingMessage={t("publish.loading")}
    >
      {experiment !== undefined && dataset !== undefined ? (
        <PageContainer width="reading" className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">{t("publish.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("publish.subtitle", { version: dataset.version, experiment: experiment.name })}
            </p>
          </div>
          <DatasetPublishFlow dataset={dataset} experiment={experiment} />
        </PageContainer>
      ) : null}
    </EntityLayoutShell>
  );
}
