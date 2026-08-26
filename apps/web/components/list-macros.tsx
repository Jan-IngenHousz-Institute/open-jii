"use client";

import { X } from "lucide-react";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import { getMacroColumns } from "~/components/overview-table/macro-columns";
import { OverviewTable } from "~/components/overview-table/overview-table";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";
import { useLocale } from "~/hooks/useLocale";

import type { MacroLanguage } from "@repo/api/domains/macro/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export function ListMacros() {
  const {
    data: macros,
    isLoading,
    isPlaceholderData,
    error,
    refetch,
    search,
    setSearch,
    language,
    setLanguage,
    page,
    setPage,
  } = useMacros();
  const { t } = useTranslation(["macro", "common"]);
  const locale = useLocale();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="relative w-full md:w-[220px]">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("macros.searchPlaceholder")}
            className="w-full pr-8"
          />
          {search && (
            <button
              type="button"
              aria-label={t("macros.clearSearch")}
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-8">
          <Select
            value={language ?? "all"}
            onValueChange={(value: string) =>
              setLanguage(value === "all" ? undefined : (value as MacroLanguage))
            }
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder={t("macros.filterByLanguage")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("macros.allLanguages")}</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="r">R</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        aria-busy={isPlaceholderData}
        inert={isPlaceholderData}
        className={`space-y-4 transition-opacity ${isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <OverviewTable
          columns={getMacroColumns(t, locale)}
          items={macros?.items}
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          errorMessage={t("macros.errorLoading")}
          retryLabel={t("common.errors.tryAgain")}
          getRowKey={(macro) => macro.id}
          getRowHref={(macro) => `/${locale}/platform/macros/${macro.id}`}
          emptyMessage={t("macros.noMacros")}
        />

        {macros && (
          <ListPagination page={page} totalPages={macros.totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
