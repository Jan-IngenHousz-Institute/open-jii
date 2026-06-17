"use client";

import { useExperimentDashboards } from "@/hooks/experiment/useExperimentDashboards/useExperimentDashboards";
import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { CardTitle } from "@repo/ui/components/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@repo/ui/components/carousel";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ExperimentDashboardsEmptyState } from "./experiment-dashboards-empty-state";
import { FeaturedDashboardCard } from "./highlights/featured-dashboard-card";

interface ExperimentDashboardsDisplayProps {
  experimentId: string;
  hasAccess?: boolean;
  isArchived?: boolean;
}

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
  const hasDashboards = dashboards.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardTitle>{t("overview.title")}</CardTitle>
        <Skeleton className="h-[120px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>{t("overview.title")}</CardTitle>
        {hasDashboards && (
          <Link href={dashboardsHref} className="shrink-0">
            <Button variant="buttonLink" className="h-auto p-0">
              {t("overview.viewAll")}
            </Button>
          </Link>
        )}
      </div>

      {hasDashboards ? (
        <DashboardCarousel dashboards={dashboards} dashboardsHref={dashboardsHref} />
      ) : (
        <ExperimentDashboardsEmptyState
          dashboardsHref={dashboardsHref}
          visualizationsHref={visualizationsHref}
          hasAccess={hasAccess ?? false}
        />
      )}
    </div>
  );
}

function DashboardCarousel({
  dashboards,
  dashboardsHref,
}: {
  dashboards: ExperimentDashboard[];
  dashboardsHref: string;
}) {
  const showNavArrows = dashboards.length > 1;
  return (
    <Carousel opts={{ align: "start" }} className="relative">
      <CarouselContent>
        {dashboards.map((dashboard) => (
          <CarouselItem key={dashboard.id} className="min-w-0">
            <FeaturedDashboardCard
              dashboard={dashboard}
              href={`${dashboardsHref}/${dashboard.id}`}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      {showNavArrows && (
        <>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </>
      )}
    </Carousel>
  );
}
