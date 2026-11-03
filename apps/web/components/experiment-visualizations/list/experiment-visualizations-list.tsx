"use client";

import {
  createOverviewTableSorting,
  OverviewTable,
} from "@/components/overview-table/overview-table";
import { ResetSortingButton } from "@/components/overview-table/reset-sorting-button";
import { useNameUpdatedListSort } from "@/hooks/useNameUpdatedListSort";
import { sortByNameAndUpdated } from "@/util/name-updated-sort";
import { useMemo } from "react";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";

import { getVisualizationColumns } from "./visualization-columns";

interface ExperimentVisualizationsListProps {
  visualizations: ExperimentVisualization[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

/**
 * One experiment's charts as a table, sortable by name and update from the headers, newest
 * update first by default. Every chart is already loaded, so sorting stays in the browser.
 */
export default function ExperimentVisualizationsList({
  visualizations,
  experimentId,
  isLoading,
  isArchived = false,
}: ExperimentVisualizationsListProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");
  const { sort, setSort, toggleSort } = useNameUpdatedListSort();

  const basePath = isArchived ? "experiments-archive" : "experiments";
  const sorted = useMemo(() => sortByNameAndUpdated(visualizations, sort), [visualizations, sort]);

  return (
    <div className="space-y-3">
      {sort.length > 0 && (
        <div className="flex justify-end">
          <ResetSortingButton active onReset={() => setSort([])} />
        </div>
      )}
      <OverviewTable
        columns={getVisualizationColumns({ t, tCommon, experimentId })}
        sorting={createOverviewTableSorting(sort, toggleSort, {
          unsorted: tCommon("common.sortUnsorted"),
          asc: tCommon("common.sortAscending"),
          desc: tCommon("common.sortDescending"),
          secondary: tCommon("common.sortSecondary"),
        })}
        items={sorted}
        isLoading={isLoading}
        getRowKey={(visualization) => visualization.id}
        getRowHref={(visualization) =>
          `/platform/${basePath}/${experimentId}/analysis/visualizations/${visualization.id}`
        }
        emptyMessage={t("ui.messages.noVisualizations")}
        emptyHelpPath={isArchived ? undefined : "/guide/data-analysis/viewing-data"}
      />
    </div>
  );
}
