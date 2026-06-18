"use client";

import { formatDate } from "@/util/date";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";

import { DashboardThumbnail } from "../thumbnail/dashboard-thumbnail";

export interface FeaturedDashboardCardProps {
  dashboard: ExperimentDashboard;
  href: string;
}

const CARD_MIN_HEIGHT_PX = 540;
const THUMBNAIL_MAX_HEIGHT_PX = 460;

export function FeaturedDashboardCard({ dashboard, href }: FeaturedDashboardCardProps) {
  const { t } = useTranslation("experimentDashboards");
  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-3 pt-6" style={{ minHeight: CARD_MIN_HEIGHT_PX }}>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            <Link
              href={href}
              className="hover:text-foreground focus-visible:ring-primary/40 inline-flex max-w-full items-center gap-1.5 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2"
            >
              <span className="truncate">{dashboard.name}</span>
              <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
            </Link>
          </h3>
          <p className="text-muted-foreground text-xs">
            {t("ui.labels.updatedAgo", { date: formatDate(dashboard.updatedAt) })}
            {dashboard.createdByName && <> · {dashboard.createdByName}</>}
          </p>
        </div>
        <DashboardThumbnail
          dashboard={dashboard}
          experimentId={dashboard.experimentId}
          maxHeight={THUMBNAIL_MAX_HEIGHT_PX}
        />
      </CardContent>
    </Card>
  );
}
