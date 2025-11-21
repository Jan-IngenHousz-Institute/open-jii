"use client";

import { ErrorDisplay } from "@/components/error-display";
import ExperimentVisualizationsDisplay from "@/components/experiment-visualizations/experiment-visualizations-display";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentLocations } from "@/hooks/experiment/useExperimentLocations/useExperimentLocations";
import { useExperimentMembers } from "@/hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { notFound } from "next/navigation";
import { use, useRef } from "react";
import { ExperimentDescription } from "~/components/experiment-overview/experiment-description";
import { ExperimentDetailsCard } from "~/components/experiment-overview/experiment-details-card";
import { ExperimentLocationManagement } from "~/components/experiment-settings/experiment-location-management-card";

import type { Experiment } from "@repo/api";
import { useTranslation } from "@repo/i18n";

interface ExperimentOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ExperimentOverviewPage({ params }: ExperimentOverviewPageProps) {
  const { id } = use(params);
  const { t } = useTranslation("experiments");

  // Experiment with access info
  const { data: accessData, isLoading, error } = useExperimentAccess(id);
  const experiment = accessData?.body.experiment;
  const hasAccess = accessData?.body.hasAccess;

  // Locations
  const { data: locationsData } = useExperimentLocations(id);
  const locations = locationsData?.body ?? [];

  // Members
  const {
    data: membersData,
    isLoading: isMembersLoading,
    isError: isMembersError,
  } = useExperimentMembers(id);
  const members = membersData?.body ?? [];

  // Visualizations
  const { data: visualizationsData, isLoading: visualizationsLoading } =
    useExperimentVisualizations({ experimentId: id });

  const initialStatusRef = useRef<Experiment["status"] | null>(null);

  if (isLoading) return <div>{t("loading")}</div>;

  if (error) return <ErrorDisplay error={error} title={t("failedToLoad")} />;

  if (!accessData) return <div>{t("notFound")}</div>;

  if (!experiment) return <div>{t("notFound")}</div>;

  initialStatusRef.current ??= experiment.status;

  if (initialStatusRef.current === "archived") {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* RIGHT SIDE — EXPERIMENT DETAILS CARD (First on mobile) */}
      <ExperimentDetailsCard
        experimentId={id}
        experiment={experiment}
        locations={locations}
        members={members}
        isMembersLoading={isMembersLoading}
        isMembersError={isMembersError}
      />

      {/* LEFT SIDE CONTENT (Second on mobile) */}
      <div className="flex-1 space-y-8 md:order-1">
        <ExperimentDescription
          experimentId={id}
          description={experiment.description ?? ""}
          hasAccess={hasAccess}
        />

        <ExperimentVisualizationsDisplay
          experimentId={id}
          visualizations={visualizationsData?.body ?? []}
          isLoading={visualizationsLoading}
          hasAccess={hasAccess}
        />

        <ExperimentLocationManagement experimentId={experiment.id} hasAccess={hasAccess} />
      </div>
    </div>
  );
}
