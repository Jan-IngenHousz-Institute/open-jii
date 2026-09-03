"use client";

import { OverviewToolbar } from "@/components/overview-toolbar";
import { ListPagination } from "~/components/list-pagination";
import { getExperimentColumns } from "~/components/overview-table/experiment-columns";
import { OverviewTable } from "~/components/overview-table/overview-table";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
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
      />

      <div
        aria-busy={isPlaceholderData}
        inert={isPlaceholderData}
        className={`space-y-4 transition-opacity ${isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <OverviewTable
          columns={getExperimentColumns(t, locale)}
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
