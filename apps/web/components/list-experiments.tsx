"use client";

import { X } from "lucide-react";
import { ListPagination } from "~/components/list-pagination";
import { getExperimentColumns } from "~/components/overview-table/experiment-columns";
import { OverviewTable } from "~/components/overview-table/overview-table";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";

import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";

interface ListExperimentsProps {
  archived?: boolean;
}

export function ListExperiments({ archived = false }: ListExperimentsProps) {
  const { data, isPlaceholderData, search, setSearch, page, setPage } = useExperiments({
    archived,
  });
  const { t } = useTranslation("experiments");

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
          <button
            type="button"
            aria-label={t("experiments.clearSearch")}
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
          columns={getExperimentColumns(t)}
          items={data?.items}
          getRowKey={(experiment) => experiment.id}
          getRowHref={(experiment) =>
            archived
              ? `/platform/experiments-archive/${experiment.id}`
              : `/platform/experiments/${experiment.id}`
          }
          emptyMessage={t("experiments.noExperiments")}
          emptyHelpPath={!archived && !search ? "/guide/get-started/quick-start" : undefined}
        />

        {data && <ListPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      </div>
    </div>
  );
}
