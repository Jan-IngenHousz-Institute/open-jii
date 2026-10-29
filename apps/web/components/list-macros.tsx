"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import { ClearFiltersButton } from "~/components/overview-table/clear-filters-button";
import { getMacroColumns } from "~/components/overview-table/macro-columns";
import {
  createOverviewTableSorting,
  OverviewTable,
} from "~/components/overview-table/overview-table";
import { ResetSortingButton } from "~/components/overview-table/reset-sorting-button";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";
import { useLocale } from "~/hooks/useLocale";
import { getMacroLanguageLabel } from "~/util/macro-language";

import { zMacroLanguage } from "@repo/api/domains/macro/macro.schema";
import { zVisibility } from "@repo/api/domains/visibility/visibility.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { MultiSelectFilter } from "@repo/ui/components/multi-select-filter";
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
            <MultiSelectFilter
              title={t("macros.columns.language")}
              options={zMacroLanguage.options.map((value) => ({
                value,
                label: getMacroLanguageLabel(value),
              }))}
              selected={languages}
              onChange={setLanguages}
              emptyLabel={t("common.filterNoResults")}
              selectedCountLabel={(count) => t("common.filterSelectedCount", { count })}
            />
            <MultiSelectFilter
              title={t("macros.visibility")}
              options={zVisibility.options.map((value) => ({
                value,
                label: t(`macros.${value}`),
              }))}
              selected={visibilities}
              onChange={setVisibilities}
              emptyLabel={t("common.filterNoResults")}
              selectedCountLabel={(count) => t("common.filterSelectedCount", { count })}
            />
            <ClearFiltersButton active={hasActiveFilters} onClear={clearFilters} />
            <ResetSortingButton active={sort.length > 0} onReset={() => setSort([])} />
          </>
        }
      />

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
