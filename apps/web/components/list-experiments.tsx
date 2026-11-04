"use client";

import { CircleDashed, Eye } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getExperimentColumns } from "~/components/overview-table/experiment-columns";
import { ResourceList } from "~/components/resource-list/resource-list";
import { resourceListFilter } from "~/components/resource-list/resource-list-filter";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";

interface ListExperimentsProps {
  archived?: boolean;
}

/**
 * The searchable, sortable experiment list with pagination and URL filters.
 * `archived` shows related archived experiments with a visibility filter only.
 */
export function ListExperiments({ archived = false }: ListExperimentsProps) {
  const list = useExperiments({ archived });
  const { t } = useTranslation(["experiments", "common"]);
  const locale = useLocale();
  // Only links that ask for it take focus; the sidebar and "See all" land here too.
  const focusSearch = useSearchParams().get("focus") === "search";

  const visibility = resourceListFilter(list, "visibility", {
    label: t("filters.visibility"),
    icon: Eye,
    optionLabel: (value) => t(`visibility.${value}`),
  });
  const filters = archived
    ? [visibility]
    : [
        resourceListFilter(list, "status", {
          label: t("filters.status"),
          icon: CircleDashed,
          optionLabel: (value) => t(`status.${value}`),
        }),
        visibility,
      ];

  return (
    <ResourceList
      list={list}
      filters={filters}
      searchInput={{
        placeholder: t("experiments.searchExperiments"),
        clearLabel: t("experiments.clearSearch"),
        loadingLabel: t("experiments.loadingExperiments"),
        autoFocus: focusSearch,
      }}
      columns={getExperimentColumns(t, locale)}
      getRowKey={(experiment) => experiment.id}
      getRowHref={(experiment) =>
        archived
          ? `/${locale}/platform/experiments-archive/${experiment.id}`
          : `/${locale}/platform/experiments/${experiment.id}`
      }
      errorMessage={t("experiments.errorLoadingExperiment")}
      emptyMessages={{
        filtered: t("experiments.noFilterMatches"),
        searched: t("experiments.noMatches"),
        empty: t("experiments.noExperiments"),
      }}
      emptyHelpPath={archived ? undefined : "/guide/get-started/quick-start"}
    />
  );
}
