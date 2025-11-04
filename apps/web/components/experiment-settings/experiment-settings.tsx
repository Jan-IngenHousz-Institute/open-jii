"use client";

import { notFound } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components";

import { useExperimentAccess } from "../../hooks/experiment/useExperimentAccess/useExperimentAccess";
import { ErrorDisplay } from "../error-display";
import { ExperimentDetailsCard } from "./experiment-details-card";
import { ExperimentInfoCard } from "./experiment-info-card";
import { ExperimentLocationManagement } from "./experiment-location-management-card";
import { ExperimentMemberManagement } from "./experiment-member-management-card";
import { ExperimentVisibilityCard } from "./experiment-visibility-card";

interface ExperimentSettingsProps {
  experimentId: string;
  archived?: boolean;
}

export function ExperimentSettings({ experimentId, archived = false }: ExperimentSettingsProps) {
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

  const { experiment, hasAccess, isAdmin } = accessData.body;

  // Check if we're on the archive route but experiment is not archived
  if (archived && experiment.status !== "archived") {
    notFound();
  }

  // Check if we're on the regular route but experiment is archived
  if (!archived && experiment.status === "archived") {
    notFound();
  }

  // For archived experiments, only admins can access settings
  // For regular experiments, any member can access settings
  if (!hasAccess || (archived && !isAdmin)) {
    const message =
      archived && !isAdmin
        ? t("experiments.needAdminAccessArchived")
        : t("experiments.needMemberAccess");

    return (
      <Alert>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }
  if (archived) {
    // For archived experiments show only the info card
    return (
      <div className="space-y-6">
        <ExperimentInfoCard experimentId={experimentId} experiment={experiment} />
      </div>
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

      {/* Location Management - New Row */}
      <ExperimentLocationManagement experimentId={experimentId} />

      {/* Experiment Info Card - Last */}
      <ExperimentInfoCard experimentId={experimentId} experiment={experiment} />
    </div>
  );
}
