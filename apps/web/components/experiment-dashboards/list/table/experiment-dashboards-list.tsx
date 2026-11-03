"use client";

import {
  createOverviewTableSorting,
  OverviewTable,
} from "@/components/overview-table/overview-table";
import { ResetSortingButton } from "@/components/overview-table/reset-sorting-button";
import { useNameUpdatedListSort } from "@/hooks/useNameUpdatedListSort";
import { sortByNameAndUpdated } from "@/util/name-updated-sort";
import { useMemo } from "react";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";

import { getDashboardColumns } from "./dashboard-columns";

interface ExperimentDashboardsListProps {
  dashboards: ExperimentDashboard[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

/**
 * One experiment's dashboards as a table, sortable by name and update from the headers, newest
 * update first by default. Every dashboard is already loaded, so sorting stays in the browser.
 */
export default function ExperimentDashboardsList({
  dashboards,
  experimentId,
  isLoading,
  isArchived = false,
}: ExperimentDashboardsListProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tCommon } = useTranslation("common");
  const { sort, setSort, toggleSort } = useNameUpdatedListSort();

  const basePath = isArchived ? "experiments-archive" : "experiments";
  const sorted = useMemo(() => sortByNameAndUpdated(dashboards, sort), [dashboards, sort]);

  return (
    <div className="space-y-3">
      {sort.length > 0 && (
        <div className="flex justify-end">
          <ResetSortingButton active onReset={() => setSort([])} />
        </div>
      )}
      <OverviewTable
        columns={getDashboardColumns({ t, tCommon, experimentId, basePath })}
        sorting={createOverviewTableSorting(sort, toggleSort, {
          unsorted: tCommon("common.sortUnsorted"),
          asc: tCommon("common.sortAscending"),
          desc: tCommon("common.sortDescending"),
          secondary: tCommon("common.sortSecondary"),
        })}
        items={sorted}
        isLoading={isLoading}
        getRowKey={(dashboard) => dashboard.id}
        getRowHref={(dashboard) =>
          `/platform/${basePath}/${experimentId}/dashboards/${dashboard.id}`
        }
        emptyMessage={t("ui.messages.emptyDashboard")}
      />
    </div>
  );
}
