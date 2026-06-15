"use client";

import {
  ExperimentDataRows,
  ExperimentTableHeader,
  formatValue,
  LoadingRows,
} from "@/components/experiment-data/experiment-data-utils";
import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentTables } from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { DataFilter } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { TableBody } from "@repo/ui/components/table";

import { useDashboardFiltersForTable } from "../../dashboard-filters-context";
import { WidgetEmptyState } from "../shell/widget-empty-state";
import { projectAndOrderColumns } from "./loaded-table-columns";
import { SkeletonTableHeader } from "./skeleton-table-header";
import { TablePaginationFooter } from "./table-pagination-footer";
import { useTableSort } from "./use-table-sort";

const SKELETON_FALLBACK_COLUMN_COUNT = 6;

export interface LoadedTableViewProps {
  tableName: string;
  pageSize: number;
  experimentId: string;
  selectedColumns?: string[];
  widgetFilters?: DataFilter[];
}

export function LoadedTableView({
  tableName,
  pageSize,
  experimentId,
  selectedColumns,
  widgetFilters,
}: LoadedTableViewProps) {
  const { t } = useTranslation("experimentDashboards");
  const { tables } = useExperimentTables(experimentId);
  const tableMeta = tables?.find((tbl) => tbl.identifier === tableName);

  const [page, setPage] = useState(1);
  const { sortColumn, sortDirection, handleSort } = useTableSort(tableMeta?.defaultSortColumn);

  const dashboardFilters = useDashboardFiltersForTable(tableName);
  const mergedFilters = useMemo(() => {
    if (dashboardFilters.length === 0) {
      return widgetFilters;
    }
    return [...(widgetFilters ?? []), ...dashboardFilters];
  }, [widgetFilters, dashboardFilters]);

  // Compare filters by content so a fresh array with identical filters does
  // not bounce the user to page 1 on unrelated re-renders.
  const filtersKey = JSON.stringify(mergedFilters ?? []);

  useEffect(() => {
    setPage(1);
  }, [tableName, pageSize, filtersKey]);

  const { tableMetadata, tableRows, isLoading, error } = useExperimentData({
    experimentId,
    page,
    pageSize,
    tableName,
    orderBy: sortColumn,
    orderDirection: sortDirection,
    formatFunction: formatValue,
    errorColumn: tableMeta?.errorColumn,
    filters: mergedFilters,
  });

  const rows = tableRows ?? [];
  const totalPages = tableMetadata?.totalPages ?? 1;
  const columns = useMemo(
    () => projectAndOrderColumns(tableMetadata?.columns, selectedColumns),
    [tableMetadata?.columns, selectedColumns],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (error) {
    return (
      <WidgetEmptyState
        icon={AlertCircle}
        title={t("widget.tableLoadFailed")}
        description={t("widget.tableLoadFailedDescription")}
      />
    );
  }

  const isInitialHeaderLoad = isLoading && columns.length === 0;
  const skeletonColumnCount = columns.length > 0 ? columns.length : SKELETON_FALLBACK_COLUMN_COUNT;
  const showFooter = isLoading || totalPages > 1;

  return (
    <div className="flex h-full min-h-0 flex-col text-xs">
      <div className="text-muted-foreground min-h-0 flex-1 overflow-auto [&_td]:px-2 [&_td]:py-1 [&_td_*]:!text-xs [&_th]:h-8 [&_th]:px-2">
        <table className="w-max min-w-full caption-bottom">
          {isInitialHeaderLoad ? (
            <SkeletonTableHeader columnCount={SKELETON_FALLBACK_COLUMN_COUNT} />
          ) : (
            <ExperimentTableHeader
              headerGroups={table.getHeaderGroups()}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          )}
          <TableBody>
            {isLoading ? (
              <LoadingRows rowCount={pageSize} columnCount={skeletonColumnCount} />
            ) : (
              <ExperimentDataRows rows={table.getRowModel().rows} columnCount={columns.length} />
            )}
          </TableBody>
        </table>
      </div>
      {showFooter && (
        <TablePaginationFooter
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
