"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import { ClearFiltersButton } from "~/components/overview-table/clear-filters-button";
import {
  createOverviewTableSorting,
  OverviewTable,
} from "~/components/overview-table/overview-table";
import { getProtocolColumns } from "~/components/overview-table/protocol-columns";
import { ResetSortingButton } from "~/components/overview-table/reset-sorting-button";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";
import { useLocale } from "~/hooks/useLocale";
import { getSensorFamilyLabel } from "~/util/sensor-family";

import { zProtocolFamily } from "@repo/api/domains/protocol/protocol.schema";
import { zVisibility } from "@repo/api/domains/visibility/visibility.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { MultiSelectFilter } from "@repo/ui/components/multi-select-filter";
import { SearchInput } from "@repo/ui/components/search-input";

export function ListProtocols() {
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
    page,
    setPage,
    sort,
    setSort,
    toggleSort,
    families,
    setFamilies,
    visibilities,
    setVisibilities,
    clearFilters,
    hasActiveFilters,
  } = useProtocols();
  const { t } = useTranslation("common");
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
            placeholder={t("protocols.searchProtocols")}
            clearLabel={t("protocols.clearSearch")}
            loadingLabel={t("protocols.loadingProtocols")}
            className="w-full md:w-[220px]"
          />
        }
        filters={
          <>
            <MultiSelectFilter
              title={t("protocols.columns.family")}
              options={zProtocolFamily.options.map((value) => ({
                value,
                label: getSensorFamilyLabel(value),
              }))}
              selected={families}
              onChange={setFamilies}
              emptyLabel={t("common.filterNoResults")}
              selectedCountLabel={(count) => t("common.filterSelectedCount", { count })}
            />
            <MultiSelectFilter
              title={t("protocols.visibility")}
              options={zVisibility.options.map((value) => ({
                value,
                label: t(`protocols.${value}`),
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
          columns={getProtocolColumns(t, locale)}
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
          errorMessage={t("errors.failedToLoadProtocol")}
          retryLabel={t("errors.tryAgain")}
          getRowKey={(protocol) => protocol.id}
          getRowHref={(protocol) => `/${locale}/platform/protocols/${protocol.id}`}
          emptyMessage={t(
            hasActiveFilters
              ? "protocols.noFilterMatches"
              : hasSearch
                ? "protocols.noMatches"
                : "protocols.noProtocols",
          )}
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
