"use client";

import type { OverviewTableSortLabels } from "@/components/overview-table/overview-table";

import { useTranslation } from "@repo/i18n";

export function useOverviewSortLabels(): OverviewTableSortLabels {
  const { t } = useTranslation("common");
  return {
    unsorted: t("common.sortUnsorted"),
    asc: t("common.sortAscending"),
    desc: t("common.sortDescending"),
    secondary: t("common.sortSecondary"),
  };
}
