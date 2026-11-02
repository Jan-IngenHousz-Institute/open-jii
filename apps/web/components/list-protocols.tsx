"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import { Cpu } from "lucide-react";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import {
  createOverviewTableSorting,
  OverviewTable,
} from "~/components/overview-table/overview-table";
import { getProtocolColumns } from "~/components/overview-table/protocol-columns";
import { ResetSortingButton } from "~/components/overview-table/reset-sorting-button";
import { visibilityFilter } from "~/components/overview-table/visibility-filter";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";
import { useListFilterLabels } from "~/hooks/useListFilterLabels";
import { useLocale } from "~/hooks/useLocale";
import { getSensorFamilyLabel } from "~/util/sensor-family";

import { zProtocolFamily } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import type { ListFilter } from "@repo/ui/components/list-filter-menu";
import { ListFilterChips, ListFilterMenu } from "@repo/ui/components/list-filter-menu";
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

  const filterLabels = useListFilterLabels();
  const filters: ListFilter[] = [
    {
      key: "family",
      label: t("protocols.columns.family"),
      icon: Cpu,
      options: zProtocolFamily.options.map((value) => ({
        value,
        label: getSensorFamilyLabel(value),
      })),
      selected: families,
      onChange: setFamilies,
    },
    visibilityFilter({
      label: t("protocols.visibility"),
      optionLabel: (value) => t(`protocols.${value}`),
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
            placeholder={t("protocols.searchProtocols")}
            clearLabel={t("protocols.clearSearch")}
            loadingLabel={t("protocols.loadingProtocols")}
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
