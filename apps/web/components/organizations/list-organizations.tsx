"use client";

import { ListPagination } from "@/components/list-pagination";
import { getOrganizationColumns } from "@/components/overview-table/organization-columns";
import {
  createOverviewTableSorting,
  OverviewTable,
} from "@/components/overview-table/overview-table";
import { ResetSortingButton } from "@/components/overview-table/reset-sorting-button";
import { OverviewToolbar } from "@/components/overview-toolbar";
import { useOrganizationsList } from "@/hooks/organization/useOrganizationsList/useOrganizationsList";
import { useListFilterLabels } from "@/hooks/useListFilterLabels";
import { useLocale } from "@/hooks/useLocale";
import { Building2 } from "lucide-react";

import { zOrganizationType } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import type { ListFilter } from "@repo/ui/components/list-filter-menu";
import { ListFilterChips, ListFilterMenu } from "@repo/ui/components/list-filter-menu";
import { SearchInput } from "@repo/ui/components/search-input";

import { organizationTypeLabelKey } from "./organization-labels";
import { organizationPath } from "./organization-routes";

/** Choose an empty-state translation key, giving active filters precedence over search. */
function emptyMessageKey(hasActiveFilters: boolean, hasSearch: boolean): string {
  if (hasActiveFilters) return "organizations.noFilterMatches";
  if (hasSearch) return "organizations.noMatches";
  return "organizations.directory.emptyTitle";
}

/**
 * Organization directory table with URL-backed search, type filters, sorting,
 * and client-side pagination.
 */
export function ListOrganizations() {
  const { t } = useTranslation();
  const locale = useLocale();
  const {
    search,
    setSearch,
    isSearching,
    debouncedSearch,
    organizations,
    isPending,
    isPlaceholderData,
    isError,
    error,
    refetch,
    page,
    totalPages,
    setPage,
    sort,
    setSort,
    toggleSort,
    types,
    setTypes,
    clearFilters,
    hasActiveFilters,
  } = useOrganizationsList();
  const hasSearch = debouncedSearch.trim() !== "";

  const filterLabels = useListFilterLabels();
  const filters: ListFilter[] = [
    {
      key: "type",
      label: t("organizations.fields.type"),
      icon: Building2,
      options: zOrganizationType.options.map((value) => ({
        value,
        label: t(organizationTypeLabelKey(value)),
      })),
      selected: types,
      onChange: setTypes,
    },
  ];

  return (
    <div className="space-y-4">
      <OverviewToolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            isLoading={isSearching}
            placeholder={t("organizations.searchPlaceholder")}
            aria-label={t("organizations.searchLabel")}
            clearLabel={t("common.clear")}
            loadingLabel={t("common.loading")}
            // 224px left 146px for a 151px placeholder, clipping the ellipsis.
            className="w-full md:w-64"
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
          columns={getOrganizationColumns(t)}
          sorting={createOverviewTableSorting(sort, toggleSort, {
            unsorted: t("common.sortUnsorted"),
            asc: t("common.sortAscending"),
            desc: t("common.sortDescending"),
            secondary: t("common.sortSecondary"),
          })}
          items={isError ? undefined : organizations}
          isLoading={isPending}
          error={error}
          onRetry={() => void refetch()}
          errorMessage={t("organizations.directory.loadFailed")}
          retryLabel={t("common.errors.tryAgain")}
          getRowKey={(organization) => organization.id}
          getRowHref={(organization) => organizationPath(locale, organization.id)}
          emptyMessage={t(emptyMessageKey(hasActiveFilters, hasSearch))}
          emptyAction={
            hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t("common.clearFilters")}
              </Button>
            )
          }
        />

        {organizations.length > 0 && (
          <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
