"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { use } from "react";
import { ExperimentDataSampleTables } from "~/components/experiment-data/experiment-data-sample-tables";
import { useLocale } from "~/hooks/useLocale";

import type { Locale } from "@repo/i18n";
import { useTranslation } from "@repo/i18n/client";

interface ExperimentDataPageProps {
  params: Promise<{ id: string; locale: Locale }>;
}

export default function ExperimentDataPage({ params }: ExperimentDataPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useExperiment(id);
  const { t } = useTranslation(undefined, "experiments");
  const locale = useLocale();

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

      <ExperimentDataSampleTables experimentId={id} sampleSize={5} locale={locale} />

      <div className="space-y-6">
        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">{t("experimentData.dataSources.title")}</h5>
          <div className="text-muted-foreground text-sm">
            <p>{t("experimentData.dataSources.noSources")}</p>
            <p className="mt-2">{t("experimentData.dataSources.description")}</p>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">{t("experimentData.dataCollection.title")}</h5>
          <div className="text-muted-foreground text-sm">
            <p>{t("experimentData.dataCollection.status")}</p>
            <p className="mt-2">{t("experimentData.dataCollection.description")}</p>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">{t("experimentData.dataAnalysis.title")}</h5>
          <div className="text-muted-foreground text-sm">
            <p>{t("experimentData.dataAnalysis.noResults")}</p>
            <p className="mt-2">{t("experimentData.dataAnalysis.description")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
