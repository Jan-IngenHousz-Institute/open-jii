"use client";

import { formatDate } from "@/util/date";
import { Calendar, ChevronRight, LayoutGrid, User } from "lucide-react";
import Link from "next/link";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

interface ExperimentDashboardsListProps {
  dashboards: ExperimentDashboard[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

export default function ExperimentDashboardsList({
  dashboards,
  experimentId,
  isLoading,
  isArchived = false,
}: ExperimentDashboardsListProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tCommon } = useTranslation("common");

  const basePath = isArchived ? "experiments-archive" : "experiments";

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }

  if (dashboards.length === 0) {
    return <span>{t("ui.messages.noDashboards")}</span>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {dashboards.map((dashboard) => {
        const widgetCount = dashboard.widgets.length;
        return (
          <Link
            key={dashboard.id}
            href={`/platform/${basePath}/${experimentId}/analysis/dashboards/${dashboard.id}`}
          >
            <div className="bg-card relative flex h-full min-h-[180px] flex-col gap-3 rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg">
              <div className="mb-auto">
                <div className="mb-2 flex items-start gap-2">
                  <h3 className="text-foreground line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold md:text-lg">
                    {dashboard.name}
                  </h3>
                </div>
                <span className="text-muted-foreground mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#EDF2F6] px-2 py-1 text-xs font-medium">
                  <LayoutGrid className="h-3 w-3" />
                  {t("ui.labels.widgetCount", { count: widgetCount })}
                </span>
                <div className="text-muted-foreground mt-2 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>
                      {dashboard.createdByName ?? dashboard.createdBy.substring(0, 8) + "..."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {tCommon("common.updated")} {formatDate(dashboard.updatedAt)}
                    </span>
                  </div>
                </div>
                {dashboard.description && (
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                    {dashboard.description.length > 120
                      ? `${dashboard.description.substring(0, 120)}...`
                      : dashboard.description}
                  </p>
                )}
              </div>
              <ChevronRight className="text-foreground absolute bottom-5 right-5 h-6 w-6 md:hidden" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
