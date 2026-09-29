"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import React from "react";
import { ListPagination } from "~/components/list-pagination";
import { getMacroColumns } from "~/components/overview-table/macro-columns";
import {
  createOverviewTableSorting,
  OverviewTable,
} from "~/components/overview-table/overview-table";
import { ResetSortingButton } from "~/components/overview-table/reset-sorting-button";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";
import { useLocale } from "~/hooks/useLocale";

import type { MacroLanguage } from "@repo/api/domains/macro/macro.schema";
import { useTranslation } from "@repo/i18n";
import { SearchInput } from "@repo/ui/components/search-input";
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
    isSearchPending,
    error,
    refetch,
    search,
    debouncedSearch,
    setSearch,
    language,
    setLanguage,
    page,
    setPage,
    sort,
    setSort,
    toggleSort,
  } = useMacros();
  const { t } = useTranslation(["macro", "common"]);
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
            placeholder={t("macros.searchPlaceholder")}
            clearLabel={t("macros.clearSearch")}
            loadingLabel={t("macros.loadingMacros")}
            className="w-full md:w-[220px]"
          />
        }
        filters={
          <>
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
            <ResetSortingButton active={sort.length > 0} onReset={() => setSort([])} />
          </>
        }
      />

      <div
        aria-busy={isPlaceholderData}
        inert={isPlaceholderData}
        className={`space-y-4 transition-opacity ${isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <OverviewTable
          columns={getMacroColumns(t, locale)}
          sorting={createOverviewTableSorting(sort, toggleSort, {
            unsorted: t("common.sortUnsorted"),
            asc: t("common.sortAscending"),
            desc: t("common.sortDescending"),
            secondary: t("common.sortSecondary"),
          })}
          items={macros?.items}
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          errorMessage={t("macros.errorLoading")}
          retryLabel={t("common.errors.tryAgain")}
          getRowKey={(macro) => macro.id}
          getRowHref={(macro) => `/${locale}/platform/macros/${macro.id}`}
          emptyMessage={t(hasSearch ? "macros.noMatches" : "macros.noMacros")}
        />

        {macros && macros.items.length > 0 && (
          <ListPagination page={page} totalPages={macros.totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
