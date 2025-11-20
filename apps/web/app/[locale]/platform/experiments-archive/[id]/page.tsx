"use client";

import { ErrorDisplay } from "@/components/error-display";
import ExperimentVisualizationsDisplay from "@/components/experiment-visualizations/experiment-visualizations-display";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentLocations } from "@/hooks/experiment/useExperimentLocations/useExperimentLocations";
import { useExperimentMembers } from "@/hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { formatDate } from "@/util/date";
import { notFound } from "next/navigation";
import { use, useRef } from "react";
import { ExperimentDescription } from "~/components/experiment-overview/experiment-description";
import { ExperimentInfoCard } from "~/components/experiment-settings/experiment-info-card";
import { ExperimentLocationManagement } from "~/components/experiment-settings/experiment-location-management-card";
import { ExperimentMemberManagement } from "~/components/experiment-settings/experiment-member-management-card";
import { ExperimentVisibilityCard } from "~/components/experiment-settings/experiment-visibility-card";

import type { Experiment } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardContent, Button } from "@repo/ui/components";

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

  if (initialStatusRef.current !== "archived") {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* LEFT SIDE CONTENT */}
      <div className="flex-1 space-y-8">
        <ExperimentDescription
          experimentId={id}
          description={experiment.description ?? ""}
          hasAccess={hasAccess}
          isArchived
        />

        <ExperimentVisualizationsDisplay
          experimentId={id}
          visualizations={visualizationsData?.body ?? []}
          isLoading={visualizationsLoading}
          isArchived
          hasAccess={hasAccess}
        />

        <ExperimentLocationManagement
          experimentId={experiment.id}
          hasAccess={hasAccess}
          isArchived
        />
      </div>

      {/* RIGHT SIDE — EXPERIMENT DETAILS CARD */}
      <div className="w-full md:w-96">
        <Card className="top-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">{t("detailsTitle")}</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium">{t("experimentId")}</h4>
              <p className="text-muted-foreground">{experiment.id}</p>
            </div>

            {locationsData?.body && locationsData.body.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Experiment location(s)</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="locations-action"
                    className="text-primary"
                  >
                    Add
                  </Button>
                </div>
                <div className="text-muted-foreground">
                  {locationsData.body.map((location) => (
                    <p key={location.id} className="truncate">
                      {location.name}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium">{t("updated")}</h4>
              <p className="text-muted-foreground">{formatDate(experiment.updatedAt)}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium">{t("created")}</h4>
              <p className="text-muted-foreground">{formatDate(experiment.createdAt)}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium">{t("createdBy")}</h4>
              <p className="text-muted-foreground">
                {experiment.ownerFirstName} {experiment.ownerLastName}
              </p>
            </div>
          </CardContent>

          <div
            role="separator"
            aria-orientation="horizontal"
            className="text-muted-foreground mx-4 border-t"
          />
          <ExperimentVisibilityCard
            experimentId={id}
            initialVisibility={experiment.visibility}
            embargoUntil={experiment.embargoUntil}
            isArchived
          />

          <div
            role="separator"
            aria-orientation="horizontal"
            className="text-muted-foreground mx-4 border-t"
          />

          <ExperimentMemberManagement
            experimentId={id}
            members={members}
            isLoading={isMembersLoading}
            isError={isMembersError}
            isArchived
          />
        </Card>
        <ExperimentInfoCard experimentId={id} experiment={experiment} members={members} />
      </div>
    </div>
  );
}
