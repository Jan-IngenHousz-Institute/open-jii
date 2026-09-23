"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import { ListPagination } from "~/components/list-pagination";
import { getExperimentColumns } from "~/components/overview-table/experiment-columns";
import { OverviewTable } from "~/components/overview-table/overview-table";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { SearchInput } from "@repo/ui/components/search-input";

interface ListExperimentsProps {
  archived?: boolean;
}

export function ListExperiments({ archived = false }: ListExperimentsProps) {
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
  } = useExperiments({ archived });
  const { t } = useTranslation(["experiments", "common"]);
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
            placeholder={t("experiments.searchExperiments")}
            clearLabel={t("experiments.clearSearch")}
            loadingLabel={t("experiments.loadingExperiments")}
            className="w-full md:w-56"
          />
        }
        filters={
          sort.length ? (
            <Button variant="outline" size="sm" onClick={() => setSort([])}>
              {t("resetSorting")}
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
          columns={getExperimentColumns(t, locale)}
          sorting={{
            state: sort.map(({ field, direction }) => ({ id: field, desc: direction === "desc" })),
            onToggle: (field, multi) => toggleSort(field as (typeof sort)[number]["field"], multi),
            labels: {
              unsorted: t("sortUnsorted"),
              asc: t("sortAscending"),
              desc: t("sortDescending"),
              secondary: t("sortSecondary"),
            },
          }}
          items={data?.items}
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          errorMessage={t("experiments.errorLoadingExperiment")}
          retryLabel={t("common.errors.tryAgain")}
          getRowKey={(experiment) => experiment.id}
          getRowHref={(experiment) =>
            archived
              ? `/${locale}/platform/experiments-archive/${experiment.id}`
              : `/${locale}/platform/experiments/${experiment.id}`
          }
          emptyMessage={t(hasSearch ? "experiments.noMatches" : "experiments.noExperiments")}
          emptyHelpPath={!archived && !hasSearch ? "/guide/get-started/quick-start" : undefined}
        />

        {data && data.items.length > 0 && (
          <ListPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
