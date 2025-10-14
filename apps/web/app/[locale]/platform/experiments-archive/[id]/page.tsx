"use client";

import { ErrorDisplay } from "@/components/error-display";
import { ExperimentLocationsDisplay } from "@/components/experiment/experiment-locations-display";
import { FlowEditor } from "@/components/flow-editor";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useExperimentLocations } from "@/hooks/experiment/useExperimentLocations/useExperimentLocations";
import { formatDate } from "@/util/date";
import { CalendarIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { use } from "react";

import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  RichTextRenderer,
} from "@repo/ui/components";

interface ExperimentOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ExperimentOverviewPage({ params }: ExperimentOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useExperiment(id);
  const { t } = useTranslation("experiments");

  // Get flow data for this experiment
  const experiment = data?.body;
  const { data: experimentFlow } = useExperimentFlow(id);

  // Get locations data for this experiment
  const { data: locationsData, isLoading: locationsLoading } = useExperimentLocations(id);
  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("failedToLoad")} />;
  }

  if (!data) {
    return <div>{t("notFound")}</div>;
  }

  // Body may still be undefined even if data exists; guard explicitly
  if (!experiment) {
    return <div>{t("notFound")}</div>;
  }

  // Check if experiment is archived - if not, redirect to not found
  if (experiment.status !== "archived") {
    notFound();
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-secondary">{t("status.active")}</Badge>;
      case "provisioning":
        return <Badge className="bg-highlight text-black">{t("status.provisioning")}</Badge>;
      case "archived":
        return <Badge className="bg-muted">{t("status.archived")}</Badge>;
      case "stale":
        return <Badge className="bg-tertiary">{t("status.stale")}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Experiment info card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-2xl">{experiment.name}</CardTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(experiment.status)}
              <Badge variant="outline" className="ml-2 capitalize">
                {experiment.visibility}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">{t("created")}</h4>
              <p className="flex items-center gap-1">
                <CalendarIcon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                {formatDate(experiment.createdAt)}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">{t("updated")}</h4>
              <p>{formatDate(experiment.updatedAt)}</p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">{t("experimentId")}</h4>
              <p className="truncate font-mono text-xs">{experiment.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>{t("descriptionTitle")}</CardHeader>
        <CardContent>
          <RichTextRenderer content={experiment.description ?? ""} />
        </CardContent>
      </Card>

      {/* Locations Display */}
      <ExperimentLocationsDisplay
        locations={locationsData?.body ?? []}
        isLoading={locationsLoading}
      />

      {/* Flow Display */}
      {experimentFlow?.body && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{t("flow.title")}</h3>
              <p className="text-muted-foreground text-sm">{t("flow.staticDescription")}</p>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium text-blue-700">{t("previewMode")}</span>
            </div>
          </div>
          <FlowEditor initialFlow={experimentFlow.body} isDisabled={true} />
        </div>
      )}
    </div>
  );
}
