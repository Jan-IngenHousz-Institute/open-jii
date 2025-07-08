"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { use } from "react";
import { ExperimentDataTable } from "~/components/experiment-data/experiment-data-table";

import { useTranslation } from "@repo/i18n/client";

interface ExperimentDataDetailsPageProps {
  params: Promise<{ id: string; tableName: string }>;
}

export default function ExperimentDataDetailsPage({ params }: ExperimentDataDetailsPageProps) {
  const { id, tableName } = use(params);
  const { data, isLoading, error } = useExperiment(id);
  const { t } = useTranslation(undefined, "experiments");

  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("failedToLoad")} />;
  }

  if (!data) {
    return <div>{t("notFound")}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-medium">{t("experimentData.title")}</h4>
        <p className="text-muted-foreground text-sm">{t("experimentData.description")}</p>
      </div>

      <ExperimentDataTable experimentId={id} tableName={tableName} pageSize={10} />
    </div>
  );
}
