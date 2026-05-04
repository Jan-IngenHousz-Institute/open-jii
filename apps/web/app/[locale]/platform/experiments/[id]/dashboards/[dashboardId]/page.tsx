"use client";

import { DashboardRenderer } from "@/components/experiment-dashboards/dashboard-renderer";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentDashboard } from "@/hooks/experiment/useExperimentDashboard/useExperimentDashboard";
import { useLocale } from "@/hooks/useLocale";
import { ChevronLeft, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export default function DashboardViewPage() {
  const { t } = useTranslation("experimentDashboards");
  const locale = useLocale();
  const { id: experimentId, dashboardId } = useParams<{
    id: string;
    dashboardId: string;
  }>();

  const { data: accessData } = useExperimentAccess(experimentId);
  const isAdmin = accessData?.body.isAdmin ?? false;

  const { data, isLoading, error } = useExperimentDashboard(dashboardId, experimentId);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{t("ui.messages.loading")}</span>
      </div>
    );
  }

  if (error || !data?.body) {
    return (
      <div className="text-muted-foreground bg-muted/30 rounded-md border border-dashed p-6 text-center">
        {t("ui.messages.loadFailed")}
      </div>
    );
  }

  const dashboard = data.body;
  const editHref = `/${locale}/platform/experiments/${experimentId}/dashboards/${dashboardId}/edit`;
  const backHref = `/${locale}/platform/experiments/${experimentId}/dashboards`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("ui.actions.back")}
          </Link>
          <h1 className="text-foreground truncate text-2xl font-bold tracking-tight">
            {dashboard.name}
          </h1>
          {dashboard.description && (
            <p className="text-muted-foreground text-sm">{dashboard.description}</p>
          )}
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link href={editHref}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("ui.actions.edit")}
            </Link>
          </Button>
        )}
      </div>

      <DashboardRenderer dashboard={dashboard} experimentId={experimentId} />
    </div>
  );
}
