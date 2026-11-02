"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import { Code } from "lucide-react";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import { getMacroColumns } from "~/components/overview-table/macro-columns";
import {
  createOverviewTableSorting,
  OverviewTable,
} from "~/components/overview-table/overview-table";
import { ResetSortingButton } from "~/components/overview-table/reset-sorting-button";
import { visibilityFilter } from "~/components/overview-table/visibility-filter";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";
import { useListFilterLabels } from "~/hooks/useListFilterLabels";
import { useLocale } from "~/hooks/useLocale";
import { getMacroLanguageLabel } from "~/util/macro-language";

import { zMacroLanguage } from "@repo/api/domains/macro/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import type { ListFilter } from "@repo/ui/components/list-filter-menu";
import { ListFilterChips, ListFilterMenu } from "@repo/ui/components/list-filter-menu";
import { SearchInput } from "@repo/ui/components/search-input";

export function ListMacros() {
  const {
    data: macros,
    isLoading,
    isPlaceholderData,
    isSearchPending,
    error,
    refetch,
    search,
    debouncedSearch,
    setSearch,
    page,
    setPage,
    sort,
    setSort,
    toggleSort,
    languages,
    setLanguages,
    visibilities,
    setVisibilities,
    clearFilters,
    hasActiveFilters,
  } = useMacros();
  const { t } = useTranslation(["macro", "common"]);
  const locale = useLocale();
  const hasSearch = debouncedSearch.trim() !== "";

  const filterLabels = useListFilterLabels();
  const filters: ListFilter[] = [
    {
      key: "language",
      label: t("macros.columns.language"),
      icon: Code,
      options: zMacroLanguage.options.map((value) => ({
        value,
        label: getMacroLanguageLabel(value),
      })),
      selected: languages,
      onChange: setLanguages,
    },
    visibilityFilter({
      label: t("macros.visibility"),
      optionLabel: (value) => t(`macros.${value}`),
      selected: visibilities,
      onChange: setVisibilities,
    }),
  ];

  return (
    <div className="space-y-4">
      <OverviewToolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            isLoading={isSearchPending}
            placeholder={t("macros.searchPlaceholder")}
            clearLabel={t("macros.clearSearch")}
            loadingLabel={t("macros.loadingMacros")}
            className="w-full md:w-[220px]"
          />
        }
        filters={
          <>
            <ListFilterMenu filters={filters} labels={filterLabels} />
            <ResetSortingButton active={sort.length > 0} onReset={() => setSort([])} />
          </>
        }
      />
      <ListFilterChips filters={filters} labels={filterLabels} onClear={clearFilters} />

      <div
        aria-busy={isPlaceholderData}
        inert={isPlaceholderData}
        className={`space-y-4 transition-opacity ${isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <OverviewTable
          columns={getMacroColumns(t, locale)}
          sorting={createOverviewTableSorting(sort, toggleSort, {
            unsorted: t("common.sortUnsorted"),
            asc: t("common.sortAscending"),
            desc: t("common.sortDescending"),
            secondary: t("common.sortSecondary"),
          })}
          items={macros?.items}
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          errorMessage={t("macros.errorLoading")}
          retryLabel={t("common.errors.tryAgain")}
          getRowKey={(macro) => macro.id}
          getRowHref={(macro) => `/${locale}/platform/macros/${macro.id}`}
          emptyMessage={t(
            hasActiveFilters
              ? "macros.noFilterMatches"
              : hasSearch
                ? "macros.noMatches"
                : "macros.noMacros",
          )}
          emptyAction={
            hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t("common.clearFilters")}
              </Button>
            )
          }
        />

        {macros && macros.items.length > 0 && (
          <ListPagination page={page} totalPages={macros.totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
