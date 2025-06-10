"use client";

import { useTranslation } from "@repo/i18n";

import { useExperiment } from "../hooks/experiment/useExperiment/useExperiment";
import { ErrorDisplay } from "./error-display";

interface ExperimentDataProps {
  experimentId: string;
}

export function ExperimentData({ experimentId }: ExperimentDataProps) {
  const { data, isLoading, error } = useExperiment(experimentId);
  const { t } = useTranslation(undefined, "experimentData");

  if (isLoading) {
    return <div>{t("experimentData.loading")}</div>;
  }

  if (error) {
    return (
      <ErrorDisplay error={error} title={t("experimentData.failedToLoad")} />
    );
  }

  if (!data) {
    return <div>{t("experimentData.notFound")}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-medium">{t("experimentData.title")}</h4>
        <p className="text-muted-foreground text-sm">
          {t("experimentData.description")}
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">
            {t("experimentData.dataSources.title")}
          </h5>
          <div className="text-muted-foreground text-sm">
            <p>{t("experimentData.dataSources.noSources")}</p>
            <p className="mt-2">
              {t("experimentData.dataSources.description")}
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">
            {t("experimentData.dataCollection.title")}
          </h5>
          <div className="text-muted-foreground text-sm">
            <p>{t("experimentData.dataCollection.status")}</p>
            <p className="mt-2">
              {t("experimentData.dataCollection.description")}
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">
            {t("experimentData.dataAnalysis.title")}
          </h5>
          <div className="text-muted-foreground text-sm">
            <p>{t("experimentData.dataAnalysis.noResults")}</p>
            <p className="mt-2">
              {t("experimentData.dataAnalysis.description")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
