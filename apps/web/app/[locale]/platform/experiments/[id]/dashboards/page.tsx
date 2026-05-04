"use client";

import ExperimentDashboardsList from "@/components/experiment-dashboards/experiment-dashboards-list";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentDashboardCreate } from "@/hooks/experiment/useExperimentDashboardCreate/useExperimentDashboardCreate";
import { useExperimentDashboards } from "@/hooks/experiment/useExperimentDashboards/useExperimentDashboards";
import { useLocale } from "@/hooks/useLocale";
import { Loader2, PlusCircle } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export default function ExperimentDashboardsPage() {
  const { t } = useTranslation("experimentDashboards");
  const { id: experimentId } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();

  const { data: accessData } = useExperimentAccess(experimentId);
  const experimentData = accessData?.body.experiment;
  const hasAccess = accessData?.body.isAdmin;

  if (experimentData?.status === "archived") {
    notFound();
  }

  const { data: dashboardsData, isLoading } = useExperimentDashboards({ experimentId });

  const { mutate: createDashboard, isPending: isCreating } = useExperimentDashboardCreate({
    experimentId,
    onSuccess: (created) => {
      router.push(
        `/${locale}/platform/experiments/${experimentId}/dashboards/${created.id}/edit`,
      );
    },
  });

  const handleCreate = () => {
    const defaultName = `${t("form.namePlaceholder")} - ${new Date().toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
    createDashboard({
      params: { id: experimentId },
      body: { name: defaultName },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("ui.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("ui.subtitle")}</p>
        </div>
        <Button onClick={handleCreate} disabled={!hasAccess || isCreating}>
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlusCircle className="mr-2 h-4 w-4" />
          )}
          {t("ui.actions.create")}
        </Button>
      </div>

      <ExperimentDashboardsList
        dashboards={dashboardsData?.body ?? []}
        experimentId={experimentId}
        isLoading={isLoading}
      />
    </div>
  );
}
