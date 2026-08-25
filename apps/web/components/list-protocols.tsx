"use client";

import { X } from "lucide-react";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import { OverviewTable } from "~/components/overview-table/overview-table";
import { getProtocolColumns } from "~/components/overview-table/protocol-columns";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";

export function ListProtocols() {
  const { data, isPlaceholderData, search, setSearch, page, setPage } = useProtocols();
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
          <button
            type="button"
            aria-label={t("protocols.clearSearch")}
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        aria-busy={isPlaceholderData}
        className={`space-y-4 transition-opacity${isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <OverviewTable
          columns={getProtocolColumns(t)}
          items={data?.items}
          getRowKey={(protocol) => protocol.id}
          getRowHref={(protocol) => `/${locale}/platform/protocols/${protocol.id}`}
          emptyMessage={t("protocols.noProtocols")}
        />

        {data && <ListPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      </div>
    </div>
  );
}
