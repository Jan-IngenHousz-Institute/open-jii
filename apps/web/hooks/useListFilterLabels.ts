"use client";

import { useTranslation } from "@repo/i18n";
import type { ListFilterLabels } from "@repo/ui/components/list-filter-menu";

export function useListFilterLabels(): ListFilterLabels {
  const { t } = useTranslation("common");
  return {
    filter: t("common.filter"),
    addFilter: t("common.addFilter"),
    is: t("common.filterIs"),
    chip: (filter, value) => t("common.filterChip", { filter, value }),
    back: t("common.filterBack"),
    clearFilters: t("common.clearFilters"),
    selectedCount: (count) => t("common.filterSelectedCount", { count }),
    removeValue: (filter, value) => t("common.removeFilterValue", { filter, value }),
  };
}
