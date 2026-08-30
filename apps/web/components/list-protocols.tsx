"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import { OverviewTable } from "~/components/overview-table/overview-table";
import { getProtocolColumns } from "~/components/overview-table/protocol-columns";
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
  } = useProtocols();
  const { t } = useTranslation("common");
  const locale = useLocale();
  const hasSearch = debouncedSearch.trim() !== "";

  // The rows this page renders, so every strip shares one request.
  const pageIds = (data?.items ?? []).map((item) => item.id);

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
      />

      <div
        aria-busy={isPlaceholderData}
        inert={isPlaceholderData}
        className={`space-y-4 transition-opacity ${isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <OverviewTable
          columns={getProtocolColumns(t, locale, pageIds)}
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
