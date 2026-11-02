"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { personName } from "@/components/people/person-name";
import { formatDate } from "@/util/date";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
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
  const author = personName({ displayName: dashboard.createdByName }, t, {
    placement: "byline",
  });
  const subtitle = author ? `${updatedLabel} · ${author}` : updatedLabel;
  return (
    <Card className="hover:border-foreground/20 group relative overflow-hidden shadow-none transition-colors">
      <IntentLink
        href={href}
        aria-label={dashboard.name}
        className="focus-visible:ring-primary/40 focus-visible:outline-hidden absolute inset-0 z-10 rounded-xl focus-visible:ring-2"
      />
      <CardContent className="space-y-3">
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
