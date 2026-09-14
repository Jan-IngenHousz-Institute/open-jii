"use client";

import { useLocale } from "@/hooks/useLocale";
import { Plus } from "lucide-react";
import Link from "next/link";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardTitle } from "@repo/ui/components/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@repo/ui/components/carousel";
import { Skeleton } from "@repo/ui/components/skeleton";

import { FeaturedVisualizationCard } from "./highlights/featured-visualization-card";

interface ExperimentVisualizationsDisplayProps {
  experimentId: string;
  visualizations: ExperimentVisualization[];
  isLoading?: boolean;
  isArchived?: boolean;
  hasAccess?: boolean;
}

export default function ExperimentVisualizationsDisplay({
  experimentId,
  visualizations,
  isLoading = false,
  isArchived = false,
  hasAccess = false,
}: ExperimentVisualizationsDisplayProps) {
  const { t } = useTranslation("experimentVisualizations");
  const locale = useLocale();

  const basePath = isArchived ? "experiments-archive" : "experiments";
  const visualizationsHref = `/${locale}/platform/${basePath}/${experimentId}/analysis/visualizations`;

  if (isLoading) {
    return (
      <div className="space-y-4 p-0">
        <div>
          <CardTitle>{t("ui.title")}</CardTitle>
          <CardDescription>{t("selector.noVisualizations")}</CardDescription>
        </div>
        <Skeleton className="h-[250px]" />
      </div>
    );
  }

  if (visualizations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="p-0">
          <CardTitle>{t("ui.title")}</CardTitle>
          <CardDescription>{t("selector.noVisualizations")}</CardDescription>
        </div>
        <Card padding="none" className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-muted mb-4 flex h-24 w-24 items-center justify-center rounded-full">
              <svg
                className="text-muted-foreground h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            {isArchived || !hasAccess ? (
              <Button variant="secondary" disabled>
                <Plus className="size-4" aria-hidden />
                {t("selector.createVisualization")}
              </Button>
            ) : (
              <Link
                href={`/en-US/platform/experiments/${experimentId}/analysis/visualizations`}
                passHref
              >
                <Button variant="secondary">
                  <Plus className="size-4" aria-hidden />
                  {t("selector.createVisualization")}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>{t("ui.title")}</CardTitle>
        <Link href={visualizationsHref} className="shrink-0">
          <Button variant="link" className="h-auto p-0">
            {t("ui.labels.viewAll")}
          </Button>
        </Link>
      </div>

      <VisualizationCarousel
        visualizations={visualizations}
        experimentId={experimentId}
        visualizationsHref={visualizationsHref}
      />
    </div>
  );
}

function VisualizationCarousel({
  visualizations,
  experimentId,
  visualizationsHref,
}: {
  visualizations: ExperimentVisualization[];
  experimentId: string;
  visualizationsHref: string;
}) {
  const showNavArrows = visualizations.length > 1;

  return (
    <Carousel opts={{ align: "start" }} className="relative">
      <CarouselContent>
        {visualizations.map((visualization) => (
          <CarouselItem key={visualization.id} className="min-w-0">
            <FeaturedVisualizationCard
              visualization={visualization}
              experimentId={experimentId}
              href={`${visualizationsHref}/${visualization.id}`}
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
