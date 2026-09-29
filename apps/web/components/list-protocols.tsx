"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import {
  createOverviewTableSorting,
  OverviewTable,
} from "~/components/overview-table/overview-table";
import { getProtocolColumns } from "~/components/overview-table/protocol-columns";
import { ResetSortingButton } from "~/components/overview-table/reset-sorting-button";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
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
        filters={<ResetSortingButton active={sort.length > 0} onReset={() => setSort([])} />}
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
          emptyMessage={t(hasSearch ? "protocols.noMatches" : "protocols.noProtocols")}
        />

        {data && data.items.length > 0 && (
          <ListPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
