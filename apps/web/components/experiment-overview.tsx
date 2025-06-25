"use client";

import { formatDate } from "@/util/date";

import { useTranslation } from "@repo/i18n";

import { useExperiment } from "../hooks/experiment/useExperiment/useExperiment";

interface ExperimentOverviewProps {
  experimentId: string;
}

export function ExperimentOverview({ experimentId }: ExperimentOverviewProps) {
  const { data, isLoading } = useExperiment(experimentId);
  const { t } = useTranslation(undefined, "common");

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (!data) {
    return <div>{t("experimentSettings.notFound")}</div>;
  }

  const experiment = data.body;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              {t("experimentSettings.name")}
            </h4>
            <p className="text-lg">{experiment.name}</p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              {t("experimentSettings.description")}
            </h4>
            <p className="text-sm">{experiment.description ?? t("experiments.noDescription")}</p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">{t("experiments.status")}</h4>
            <p className="text-sm capitalize">{experiment.status}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              {t("experimentSettings.visibility")}
            </h4>
            <p className="text-sm capitalize">{experiment.visibility}</p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              {t("experimentSettings.embargoIntervalDays")}
            </h4>
            <p className="text-sm">
              {experiment.embargoIntervalDays} {t("common.days")}
            </p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              {t("experimentSettings.created")}
            </h4>
            <p className="text-sm">{formatDate(experiment.createdAt)}</p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              {t("experimentSettings.updated")}
            </h4>
            <p className="text-sm">{formatDate(experiment.updatedAt)}</p>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <h4 className="text-muted-foreground mb-2 text-sm font-medium">
          {t("experiments.experimentId")}
        </h4>
        <p className="bg-muted rounded p-2 font-mono text-sm">{experiment.id}</p>
      </div>
    </div>
  );
}
