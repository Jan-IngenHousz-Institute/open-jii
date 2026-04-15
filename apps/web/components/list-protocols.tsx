"use client";

import { X } from "lucide-react";
import React from "react";
import { ProtocolOverviewCards } from "~/components/protocol-overview-cards";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";

import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
export function ListProtocols() {
  const { protocols, filter, setFilter, search, setSearch } = useProtocols({});
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
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
        <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-8">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder={t("protocols.filterProtocols")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">{t("protocols.filterMy")}</SelectItem>
              <SelectItem value="all">{t("protocols.filterAll")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ProtocolOverviewCards protocols={protocols} />
    </div>
  );
}
