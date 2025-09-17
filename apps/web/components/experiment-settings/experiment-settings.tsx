"use client";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components";

import { useExperimentAccess } from "../../hooks/experiment/useExperimentAccess/useExperimentAccess";
import { ErrorDisplay } from "../error-display";
import { ExperimentDetailsCard } from "./experiment-details-card";
import { ExperimentInfoCard } from "./experiment-info-card";
import { ExperimentMemberManagement } from "./experiment-member-management-card";
import { ExperimentProtocolManagement } from "./experiment-protocol-management-card";
import { ExperimentVisibilityCard } from "./experiment-visibility-card";

interface ExperimentSettingsProps {
  experimentId: string;
}

export function ExperimentSettings({ experimentId }: ExperimentSettingsProps) {
  const { data: accessData, error, isLoading } = useExperimentAccess(experimentId);
  const { t } = useTranslation();

  if (isLoading) {
    return <div>{t("experimentSettings.loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("errors.error")} />;
  }

  if (!accessData?.body.experiment) {
    return <div>{t("experimentSettings.notFound")}</div>;
  }

  const { experiment, hasAccess } = accessData.body;

  // Only members can access settings
  if (!hasAccess) {
    return (
      <Alert>
        <AlertDescription>{t("experiments.needMemberAccess")}</AlertDescription>
      </Alert>
    );
  }

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
          embargoUntil={experiment.embargoUntil}
        />
      </div>

      {/* Protocol Management - New Row */}
      <ExperimentProtocolManagement experimentId={experimentId} />

      {/* Experiment Info Card - Last */}
      <ExperimentInfoCard experimentId={experimentId} experiment={experiment} />
    </div>
  );
}
