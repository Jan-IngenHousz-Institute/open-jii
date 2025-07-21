"use client";

import { useTranslation } from "@repo/i18n";

import { useExperiment } from "../../hooks/experiment/useExperiment/useExperiment";
import { ExperimentDetailsCard } from "./experiment-details-card";
import { ExperimentInfoCard } from "./experiment-info-card";
import { ExperimentMemberManagement } from "./experiment-member-management-card";
import { ExperimentVisibilityCard } from "./experiment-visibility-card";

interface ExperimentSettingsProps {
  experimentId: string;
}

export function ExperimentSettings({ experimentId }: ExperimentSettingsProps) {
  const { data, isLoading } = useExperiment(experimentId);
  const { t } = useTranslation();

  if (isLoading) {
    return <div>{t("experimentSettings.loading")}</div>;
  }

  if (!data) {
    return <div>{t("experimentSettings.notFound")}</div>;
  }

  const experiment = data.body;

  return (
    <div className="space-y-6">
      {/* Edit Experiment Details Card - First */}
      <ExperimentDetailsCard
        experimentId={experimentId}
        initialName={experiment.name}
        initialDescription={experiment.description ?? ""}
      />

      {/* Member Management and Visibility Settings - Side by Side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ExperimentMemberManagement experimentId={experimentId} />
        <ExperimentVisibilityCard
          experimentId={experimentId}
          initialVisibility={experiment.visibility}
          initialEmbargoIntervalDays={experiment.embargoIntervalDays}
        />
      </div>

      {/* Experiment Info Card - Last */}
      <ExperimentInfoCard experimentId={experimentId} experiment={experiment} />
    </div>
  );
}
