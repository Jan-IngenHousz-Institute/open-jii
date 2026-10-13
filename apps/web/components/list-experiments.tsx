"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import { useSearchParams } from "next/navigation";
import { ListPagination } from "~/components/list-pagination";
import { ClearFiltersButton } from "~/components/overview-table/clear-filters-button";
import { getExperimentColumns } from "~/components/overview-table/experiment-columns";
import {
  createOverviewTableSorting,
  OverviewTable,
} from "~/components/overview-table/overview-table";
import { ResetSortingButton } from "~/components/overview-table/reset-sorting-button";
import { EXPERIMENT_STATUS_FILTER_VALUES } from "~/hooks/experiment/useExperiments/useExperimentListFilters";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";
import { useLocale } from "~/hooks/useLocale";

import { zExperimentVisibility } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { MultiSelectFilter } from "@repo/ui/components/multi-select-filter";
import { SearchInput } from "@repo/ui/components/search-input";

interface ListExperimentsProps {
  archived?: boolean;
}

/**
 * Render the searchable, sortable experiment list with pagination and URL filters.
 * `archived` shows related archived experiments with a visibility filter only.
 * Active filters can be cleared from the toolbar or an empty result without clearing search or sort.
 */
export function ListExperiments({ archived = false }: ListExperimentsProps) {
  const {
    data,
    isLoading,
    isPlaceholderData,
    isSearchPending,
    error,
    refetch,
    search,
    debouncedSearch,
    setSearch,
    statuses,
    setStatuses,
    visibilities,
    setVisibilities,
    clearFilters,
    hasActiveFilters,
    page,
    setPage,
    sort,
    setSort,
    toggleSort,
  } = useExperiments({ archived });
  const { t } = useTranslation(["experiments", "common"]);
  const locale = useLocale();
  const hasSearch = debouncedSearch.trim() !== "";
  // Only links that ask for it take focus; the sidebar and "See all" land here too.
  const focusSearch = useSearchParams().get("focus") === "search";

  return (
    <div className="space-y-4">
      <OverviewToolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            isLoading={isSearchPending}
            autoFocus={focusSearch}
            placeholder={t("experiments.searchExperiments")}
            clearLabel={t("experiments.clearSearch")}
            loadingLabel={t("experiments.loadingExperiments")}
            className="w-full md:w-56"
          />
        }
        filters={
          <>
            {!archived && (
              <MultiSelectFilter
                title={t("filters.status")}
                options={EXPERIMENT_STATUS_FILTER_VALUES.options.map((value) => ({
                  value,
                  label: t(`status.${value}`),
                }))}
                selected={statuses}
                onChange={setStatuses}
                emptyLabel={t("common.filterNoResults")}
                selectedCountLabel={(count) => t("common.filterSelectedCount", { count })}
              />
            )}
            <MultiSelectFilter
              title={t("filters.visibility")}
              options={zExperimentVisibility.options.map((value) => ({
                value,
                label: t(`visibility.${value}`),
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
          columns={getExperimentColumns(t, locale)}
          sorting={createOverviewTableSorting(sort, toggleSort, {
            unsorted: t("common.sortUnsorted"),
            asc: t("common.sortAscending"),
            desc: t("common.sortDescending"),
            secondary: t("common.sortSecondary"),
          })}
          items={data?.items}
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          errorMessage={t("experiments.errorLoadingExperiment")}
          retryLabel={t("common.errors.tryAgain")}
          getRowKey={(experiment) => experiment.id}
          getRowHref={(experiment) =>
            archived
              ? `/${locale}/platform/experiments-archive/${experiment.id}`
              : `/${locale}/platform/experiments/${experiment.id}`
          }
          emptyMessage={t(
            hasActiveFilters
              ? "experiments.noFilterMatches"
              : hasSearch
                ? "experiments.noMatches"
                : "experiments.noExperiments",
          )}
          emptyHelpPath={
            !archived && !hasSearch && !hasActiveFilters
              ? "/guide/get-started/quick-start"
              : undefined
          }
          emptyAction={
            hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t("common.clearFilters")}
              </Button>
            )
          }
        />

        {data && data.items.length > 0 && (
          <ListPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
