"use client";

import { BarChart3, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";

export interface ExperimentDashboardsEmptyStateProps {
  dashboardsHref: string;
  visualizationsHref: string;
  hasAccess: boolean;
}

export function ExperimentDashboardsEmptyState({
  dashboardsHref,
  visualizationsHref,
  hasAccess,
}: ExperimentDashboardsEmptyStateProps) {
  const { t } = useTranslation("experimentDashboards");
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="bg-muted mb-4 flex h-24 w-24 items-center justify-center rounded-full">
          <LayoutGrid className="text-muted-foreground h-12 w-12" />
        </div>
        <h3 className="text-foreground text-base font-medium">{t("overview.emptyTitle")}</h3>
        <p className="text-muted-foreground mt-1 text-center text-sm">
          {t("overview.emptyDescription")}
        </p>
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
      </CardContent>
    </Card>
  );
}
