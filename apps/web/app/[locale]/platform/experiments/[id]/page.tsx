"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { formatDate } from "@/util/date";
import { CalendarIcon } from "lucide-react";
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

export default function ExperimentOverviewPage({
  params,
}: ExperimentOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useExperiment(id);
  const { t } = useTranslation(undefined, "common");
  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return (
      <ErrorDisplay error={error} title={t("errors.failedToLoadExperiment")} />
    );
  }

  if (!data) {
    return <div>{t("experiments.notFound")}</div>;
  }

  const experiment = data.body;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-secondary">
            {t("experiments.status.active")}
          </Badge>
        );
      case "provisioning":
        return (
          <Badge className="bg-highlight text-black">
            {t("experiments.status.provisioning")}
          </Badge>
        );
      case "archived":
        return (
          <Badge className="bg-muted">{t("experiments.status.archived")}</Badge>
        );
      case "stale":
        return (
          <Badge className="bg-tertiary">{t("experiments.status.stale")}</Badge>
        );
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
              <h4 className="text-muted-foreground text-sm font-medium">
                {t("experimentSettings.created")}
              </h4>
              <p className="flex items-center gap-1">
                <CalendarIcon
                  className="text-muted-foreground h-4 w-4"
                  aria-hidden="true"
                />
                {formatDate(experiment.createdAt)}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                {t("experimentSettings.updated")}
              </h4>
              <p>{formatDate(experiment.updatedAt)}</p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                {t("experimentSettings.embargoIntervalDays")}
              </h4>
              <p>
                {experiment.embargoIntervalDays} {t("common.days")}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                {t("experiments.experimentId")}
              </h4>
              <p className="truncate font-mono text-xs">{experiment.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>{t("experiments.descriptionTitle")}</CardHeader>
        <CardContent>
          <RichTextRenderer content={experiment.description ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
