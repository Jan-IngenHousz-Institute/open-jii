"use client";

import { X } from "lucide-react";
import { ListPagination } from "~/components/list-pagination";
import { getExperimentColumns } from "~/components/overview-table/experiment-columns";
import { OverviewTable } from "~/components/overview-table/overview-table";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

interface ListExperimentsProps {
  archived?: boolean;
}

export function ListExperiments({ archived = false }: ListExperimentsProps) {
  const { data, isLoading, isPlaceholderData, error, refetch, search, setSearch, page, setPage } =
    useExperiments({ archived });
  const { t } = useTranslation(["experiments", "common"]);
  const locale = useLocale();

  return (
    <div className="space-y-4">
      <div className="relative w-full md:w-56">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("experiments.searchExperiments")}
          className="w-full pr-8"
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("experiments.clearSearch")}
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
          emptyMessage={t("experiments.noExperiments")}
          emptyHelpPath={!archived && !search ? "/guide/get-started/quick-start" : undefined}
        />

        {data && <ListPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      </div>
    </div>
  );
}
