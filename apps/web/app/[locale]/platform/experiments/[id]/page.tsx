"use client";

import { ExperimentDescription } from "@/features/experiments/components/experiment-overview/experiment-description";
import { ExperimentDetailsCard } from "@/features/experiments/components/experiment-overview/experiment-details/experiment-details-card";
import { ExperimentLinkedWorkbook } from "@/features/experiments/components/experiment-overview/experiment-linked-workbook";
import { ExperimentMeasurements } from "@/features/experiments/components/experiment-overview/experiment-measurements";
import { useExperimentAccess } from "@/features/experiments/hooks/useExperimentAccess/useExperimentAccess";
import { useExperimentLocations } from "@/features/experiments/hooks/useExperimentLocations/useExperimentLocations";
import { useExperimentMembers } from "@/features/experiments/hooks/useExperimentMembers/useExperimentMembers";
import { ErrorDisplay } from "@/shared/ui/error-display";
import { notFound } from "next/navigation";
import { use, useRef } from "react";

import type { Experiment } from "@repo/api/schemas/experiment.schema";
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
  const hasAccess = accessData?.body.isAdmin;

  // Locations
  const { data: locationsData } = useExperimentLocations(id);
  const locations = locationsData?.body ?? [];

  // Members
  const { data: membersData, isLoading: isMembersLoading } = useExperimentMembers(id);
  const members = membersData?.body ?? [];

  const initialStatusRef = useRef<Experiment["status"] | null>(null);

  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("failedToLoad")} />;
  }

  if (!accessData) {
    return <div>{t("notFound")}</div>;
  }

  if (!experiment) {
    return <div>{t("notFound")}</div>;
  }

  initialStatusRef.current ??= experiment.status;

  if (initialStatusRef.current === "archived") {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Right side: experiment details card (first on mobile). */}
      <ExperimentDetailsCard
        experimentId={id}
        experiment={experiment}
        locations={locations}
        members={members}
        isMembersLoading={isMembersLoading}
        hasAccess={hasAccess}
      />

      {/* LEFT SIDE CONTENT (Second on mobile) */}
      <div className="flex-1 space-y-10 md:order-1">
        <ExperimentDescription
          experimentId={id}
          description={experiment.description ?? ""}
          hasAccess={hasAccess}
        />
        <ExperimentLinkedWorkbook
          workbookId={experiment.workbookId}
          workbookVersionId={experiment.workbookVersionId}
        />
        <ExperimentMeasurements experimentId={id} />
      </div>
    </div>
  );
}
