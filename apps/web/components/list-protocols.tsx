"use client";

import { X } from "lucide-react";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import { ProtocolOverviewCards } from "~/components/protocol-overview-cards";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";

import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";

export function ListProtocols() {
  const { data, search, setSearch, page, setPage } = useProtocols();
  const { t } = useTranslation();

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

      <ProtocolOverviewCards protocols={data?.items} />

      {data && <ListPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  );
}
