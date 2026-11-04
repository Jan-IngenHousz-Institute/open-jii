"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { ListFilterChips } from "@repo/ui/components/list-filter-chips";
import type { ListFilter, ListFilterLabels } from "@repo/ui/components/list-filter-menu";
import { ListFilterMenu } from "@repo/ui/components/list-filter-menu";

interface ListFilterBarProps {
  search: ReactNode;
  filters: readonly ListFilter[];
  onClearFilters: () => void;
  actions?: ReactNode;
}

export function ListFilterBar({ search, filters, onClearFilters, actions }: ListFilterBarProps) {
  const { t } = useTranslation("common");
  const labels: ListFilterLabels = {
    filter: t("common.filter"),
    addFilter: t("common.addFilter"),
    is: t("common.filterIs"),
    chip: (filter, value) => t("common.filterChip", { filter, value }),
    back: t("common.filterBack"),
    clearFilters: t("common.clearFilters"),
    selectedCount: (count) => t("common.filterSelectedCount", { count }),
    removeValue: (filter, value) => t("common.removeFilterValue", { filter, value }),
  };

  return (
    <>
      <OverviewToolbar
        search={search}
        filters={
          <>
            <ListFilterMenu filters={filters} labels={labels} />
            {actions}
          </>
        }
      />
      <ListFilterChips filters={filters} labels={labels} onClear={onClearFilters} />
    </>
  );
}
