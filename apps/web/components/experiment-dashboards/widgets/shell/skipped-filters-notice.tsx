"use client";

import { useTranslation } from "@repo/i18n";

import type { SkippedDashboardFilter } from "../../dashboard-filters-context";

interface SkippedFiltersNoticeProps {
  skippedFilters: SkippedDashboardFilter[];
}

/** The line under a chart or table naming the dashboard filters it ignores. */
export function SkippedFiltersNotice({ skippedFilters }: SkippedFiltersNoticeProps) {
  const { t } = useTranslation("experimentDashboards");

  return (
    <p role="status" className="text-status-stale-foreground shrink-0 px-3 py-2 text-xs">
      {t("widget.filtersSkipped", {
        count: skippedFilters.length,
        names: skippedFilters.map((filter) => filter.label).join(", "),
      })}
    </p>
  );
}
