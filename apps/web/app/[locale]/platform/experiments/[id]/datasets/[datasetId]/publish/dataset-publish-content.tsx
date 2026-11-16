"use client";

import { DatasetPublishFlow } from "@/components/datasets/publish/dataset-publish-flow";
import { PageContainer } from "@/components/page-container";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useDataset } from "@/hooks/dataset/useDataset/useDataset";
import { useDatasetScope } from "@/hooks/dataset/useDatasetScope/useDatasetScope";
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
  // Scope starts from every table and day, so the flow waits for them before its form starts.
  const tables = useDatasetScope(datasetId);

  const experiment = access.data?.experiment;
  const dataset = draft.data;
  const scope = tables.data;

  return (
    <EntityLayoutShell
      isLoading={access.isLoading || draft.isLoading || tables.isLoading}
      error={access.error ?? draft.error ?? tables.error}
      hasData={experiment !== undefined && dataset !== undefined && scope !== undefined}
      loadingMessage={t("publish.loading")}
    >
      {experiment !== undefined && dataset !== undefined && scope !== undefined ? (
        <PageContainer width="reading" className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">{t("publish.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("publish.subtitle", { version: dataset.version, experiment: experiment.name })}
            </p>
          </div>
          <DatasetPublishFlow dataset={dataset} experiment={experiment} scope={scope} />
        </PageContainer>
      ) : null}
    </EntityLayoutShell>
  );
}
