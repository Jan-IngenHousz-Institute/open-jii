"use client";

import { formatDate } from "@/util/date";
import Link from "next/link";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";

import { DashboardThumbnail } from "../thumbnail/dashboard-thumbnail";

export interface HighlightCardProps {
  dashboard: ExperimentDashboard;
  href: string;
  thumbnailMaxHeight: number;
}

export function HighlightCard({ dashboard, href, thumbnailMaxHeight }: HighlightCardProps) {
  const { t } = useTranslation("experimentDashboards");
  const updatedLabel = t("ui.labels.updatedAgo", { date: formatDate(dashboard.updatedAt) });
  const subtitle = dashboard.createdByName
    ? `${updatedLabel} · ${dashboard.createdByName}`
    : updatedLabel;
  return (
    <Card className="hover:border-foreground/20 group relative overflow-hidden shadow-none transition-colors">
      <Link
        href={href}
        aria-label={dashboard.name}
        className="focus-visible:ring-primary/40 absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2"
      />
      <CardContent className="space-y-3 pt-6">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{dashboard.name}</h3>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        <DashboardThumbnail
          dashboard={dashboard}
          experimentId={dashboard.experimentId}
          maxHeight={thumbnailMaxHeight}
        />
      </CardContent>
    </Card>
  );
}
