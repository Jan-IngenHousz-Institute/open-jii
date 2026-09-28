"use client";

import { ListPagination } from "@/components/list-pagination";
import { getOrganizationColumns } from "@/components/overview-table/organization-columns";
import {
  createOverviewTableSorting,
  OverviewTable,
} from "@/components/overview-table/overview-table";
import { OverviewToolbar } from "@/components/overview-toolbar";
import { useOrganizationsList } from "@/hooks/organization/useOrganizationsList/useOrganizationsList";
import { useLocale } from "@/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { SearchInput } from "@repo/ui/components/search-input";

import { organizationPath } from "./organization-routes";

/**
 * One ownership-ranked organization directory. Membership is shown by ordering
 * and card metadata instead of making the reader switch between two partial lists.
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
  } = useOrganizationsList();
  const hasSearch = debouncedSearch.trim() !== "";

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
          sort.length ? (
            <Button variant="outline" size="sm" onClick={() => setSort([])}>
              {t("common.resetSorting")}
            </Button>
          ) : undefined
        }
      />

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
          emptyMessage={t(
            hasSearch ? "organizations.noMatches" : "organizations.directory.emptyTitle",
          )}
        />

        {organizations.length > 0 && (
          <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
