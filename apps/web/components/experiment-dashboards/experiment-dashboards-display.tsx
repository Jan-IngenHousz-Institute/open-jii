"use client";

import { useExperimentDashboards } from "@/hooks/experiment/useExperimentDashboards/useExperimentDashboards";
import { useLocale } from "@/hooks/useLocale";
import { ArrowRight, BarChart3, LayoutGrid, Loader2 } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { DashboardRenderer } from "./dashboard-renderer";

interface ExperimentDashboardsDisplayProps {
  experimentId: string;
  hasAccess?: boolean;
  isArchived?: boolean;
}

const SLIDE_WIDTH_PX = 720;

/**
 * Experiment overview slot. Replaces the prior single-chart visualizations
 * preview. Shows a horizontal scroll-snap slider of dashboard previews
 * (read-only, shrunken). Empty state offers two CTAs so users who only made
 * standalone charts aren't stuck — one path leads to dashboard creation,
 * the other to the existing visualizations list.
 */
export default function ExperimentDashboardsDisplay({
  experimentId,
  hasAccess,
  isArchived = false,
}: ExperimentDashboardsDisplayProps) {
  const { t } = useTranslation("experimentDashboards");
  const locale = useLocale();
  const { data, isLoading } = useExperimentDashboards({ experimentId });
  const dashboards = data?.body ?? [];

  const basePath = isArchived ? "experiments-archive" : "experiments";
  const dashboardsHref = `/${locale}/platform/${basePath}/${experimentId}/dashboards`;
  const visualizationsHref = `/${locale}/platform/${basePath}/${experimentId}/analysis/visualizations`;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">{t("overview.title")}</h2>
        {dashboards.length > 0 && (
          <Link
            href={dashboardsHref}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            {t("overview.viewAll")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto">
          <Skeleton className="h-64 w-[720px] shrink-0 rounded-xl" />
          <Skeleton className="h-64 w-[720px] shrink-0 rounded-xl" />
        </div>
      ) : dashboards.length === 0 ? (
        <EmptyState
          dashboardsHref={dashboardsHref}
          visualizationsHref={visualizationsHref}
          hasAccess={hasAccess ?? false}
        />
      ) : (
        <div
          className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              href={`${dashboardsHref}/${dashboard.id}`}
              className="block shrink-0 transition-transform hover:scale-[1.01]"
              style={{ width: SLIDE_WIDTH_PX, scrollSnapAlign: "start" }}
            >
              <div className="bg-card flex h-full flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-foreground truncate text-base font-semibold">
                    {dashboard.name}
                  </h3>
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <LayoutGrid className="h-3 w-3" />
                    {t("ui.labels.widgetCount", { count: dashboard.widgets.length })}
                  </span>
                </div>
                <div className="overflow-hidden rounded-md">
                  <DashboardRenderer
                    dashboard={dashboard}
                    experimentId={experimentId}
                    scale={0.5}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

interface EmptyStateProps {
  dashboardsHref: string;
  visualizationsHref: string;
  hasAccess: boolean;
}

function EmptyState({ dashboardsHref, visualizationsHref, hasAccess }: EmptyStateProps) {
  const { t } = useTranslation("experimentDashboards");
  return (
    <div className="bg-muted/20 rounded-xl border border-dashed p-8 text-center">
      <LayoutGrid className="text-muted-foreground/60 mx-auto h-10 w-10" />
      <h3 className="text-foreground mt-3 text-base font-medium">{t("overview.emptyTitle")}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{t("overview.emptyDescription")}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {hasAccess && (
          <Button asChild>
            <Link href={dashboardsHref}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              {t("overview.createDashboard")}
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href={visualizationsHref}>
            <BarChart3 className="mr-2 h-4 w-4" />
            {t("overview.browseVisualizations")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Loading variant exported for testability / loose coupling if needed. */
export function ExperimentDashboardsDisplayLoading() {
  return (
    <div className="text-muted-foreground flex h-32 items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
