"use client";

import { X } from "lucide-react";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import { OverviewTable } from "~/components/overview-table/overview-table";
import { getProtocolColumns } from "~/components/overview-table/protocol-columns";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

export function ListProtocols() {
  const { data, isLoading, isPlaceholderData, error, refetch, search, setSearch, page, setPage } =
    useProtocols();
  const { t } = useTranslation("common");
  const locale = useLocale();

  return (
    <div className="space-y-4">
      <div className="relative w-full md:w-[220px]">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("protocols.searchProtocols")}
          className="w-full pr-8"
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("protocols.clearSearch")}
            onClick={() => setSearch("")}
            className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div
        aria-busy={isPlaceholderData}
        inert={isPlaceholderData}
        className={`space-y-4 transition-opacity ${isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <OverviewTable
          columns={getProtocolColumns(t, locale)}
          items={data?.items}
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          errorMessage={t("errors.failedToLoadProtocol")}
          retryLabel={t("errors.tryAgain")}
          getRowKey={(protocol) => protocol.id}
          getRowHref={(protocol) => `/${locale}/platform/protocols/${protocol.id}`}
          emptyMessage={t("protocols.noProtocols")}
        />

        {data && <ListPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      </div>
    </div>
  );
}
