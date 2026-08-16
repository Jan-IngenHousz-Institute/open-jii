"use client";

import { DataTable } from "@/components/data-table/data-table";
import type { TableMetadata } from "@/components/data-table/data-table-columns";
import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PaginationState } from "@tanstack/react-table";
import React, { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { AddAnnotationDialog } from "~/components/experiment-data/annotations/add-annotation-dialog";
import { BulkActionsBar } from "~/components/experiment-data/annotations/bulk-actions-bar";
import { DeleteAnnotationsDialog } from "~/components/experiment-data/annotations/delete-annotations-dialog";
import { useUrlDataFilters } from "~/hooks/useUrlDataFilters";

import type { ExperimentAnnotationType } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { useTranslation } from "@repo/i18n";
import { Form } from "@repo/ui/components/form";
import { Skeleton } from "@repo/ui/components/skeleton";

import { FilterChipBar } from "../data-filters/filter-chip-bar";
import { DataExportModal } from "./data-export-modal/data-export-modal";
import { ExperimentDataTableChart } from "./table-chart/experiment-data-table-chart";

function getSortColumnName(columnName: string, columnType?: string): string {
  if (columnType === "USER") {
    return "user_name";
  }
  return columnName;
}

const bulkSelectionFormSchema = z.object({
  selectedRowIds: z.array(z.string()),
});
type BulkSelectionFormType = z.infer<typeof bulkSelectionFormSchema>;

/**
 * An experiment's data table: the shared {@link DataTable} plus everything
 * that is experiment-specific, namely the filters, annotations, bulk actions
 * and export around it.
 */
export function ExperimentDataTable({
  experimentId,
  tableName,
  pageSize = 10,
  displayName,
  defaultSortColumn,
  errorColumn,
  canContribute = false,
}: {
  experimentId: string;
  tableName: string;
  pageSize: number;
  displayName?: string;
  defaultSortColumn?: string;
  errorColumn?: string;
  /** Whether annotation controls are available. */
  canContribute?: boolean;
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [persistedMetaData, setPersistedMetaData] = useState<TableMetadata>();
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | undefined>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");

  const { filters, setFilters, completeFilters: activeFilters } = useUrlDataFilters(tableName);

  const [addAnnotationDialogOpen, setAddAnnotationDialogOpen] = useState(false);
  const [addAnnotationRowIds, setAddAnnotationRowIds] = useState<string[]>([]);
  const [addAnnotationType, setAddAnnotationType] = useState<ExperimentAnnotationType>("comment");
  const [deleteAnnotationsDialogOpen, setDeleteAnnotationsDialogOpen] = useState(false);
  const [deleteAnnotationRowIds, setDeleteAnnotationRowIds] = useState<string[]>([]);
  const [deleteAnnotationType, setDeleteAnnotationType] =
    useState<ExperimentAnnotationType>("comment");

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const selectionForm = useForm<BulkSelectionFormType>({
    resolver: zodResolver(bulkSelectionFormSchema),
    defaultValues: { selectedRowIds: [] },
  });

  const [chartDisplay, setChartDisplay] = useState<{
    data: number[];
    columnName: string;
    isPinned: boolean;
  } | null>(null);

  const { t } = useTranslation();

  const toggleChartPin = useCallback((data: number[], columnName: string) => {
    setChartDisplay((prev) => {
      if (prev?.isPinned && prev.columnName === columnName) {
        return null;
      }
      return { data, columnName, isPinned: true };
    });
  }, []);

  const closePinnedChart = useCallback(() => {
    setChartDisplay(null);
  }, []);

  const openAddAnnotationDialog = useCallback(
    (rowIds: string[], type: ExperimentAnnotationType = "comment") => {
      setAddAnnotationRowIds(rowIds);
      setAddAnnotationType(type);
      setAddAnnotationDialogOpen(true);
    },
    [],
  );

  const openDeleteAnnotationsDialog = useCallback(
    (rowIds: string[], type: ExperimentAnnotationType = "comment") => {
      setDeleteAnnotationRowIds(rowIds);
      setDeleteAnnotationType(type);
      setDeleteAnnotationsDialogOpen(true);
    },
    [],
  );

  const handleSort = useCallback(
    (columnName: string, columnType?: string) => {
      const actualSortColumn = getSortColumnName(columnName, columnType);
      if (sortColumn === actualSortColumn) {
        setSortDirection((prev) => (prev === "ASC" ? "DESC" : "ASC"));
      } else {
        setSortColumn(actualSortColumn);
        setSortDirection("ASC");
      }
    },
    [sortColumn],
  );

  const { tableMetadata, tableRows, isLoading, error } = useExperimentData({
    experimentId,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    tableName,
    orderBy: sortColumn,
    orderDirection: sortDirection,
    filters: activeFilters,
    errorColumn,
  });

  // Filters drop totalPages to 1; snap pageIndex back so the UI doesn't show "page 5 of 1".
  // Selection is keyed by row id and would point at rows that no longer exist after a filter change.
  const filtersKey = JSON.stringify(activeFilters);
  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
    setRowSelection({});
  }, [filtersKey]);

  const handlePaginationChange = useCallback<typeof setPagination>((updaterOrValue) => {
    setPagination(updaterOrValue);
    setRowSelection({});
  }, []);

  useEffect(() => {
    if (tableMetadata) {
      setPersistedMetaData(tableMetadata);
    }
  }, [tableMetadata]);

  const columns = persistedMetaData?.rawColumns ?? [];
  const totalPages = persistedMetaData?.totalPages ?? 0;
  const totalRows = persistedMetaData?.totalRows ?? 0;
  const selectedRowIds = Object.keys(rowSelection);

  if (isLoading && !persistedMetaData) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: pageSize }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div>{t("experimentDataTable.error")}</div>;
  }

  if (!tableRows && !isLoading) {
    return <div>{t("experimentDataTable.noData")}</div>;
  }

  // A last page holds the remainder, except when the total divides evenly and
  // it is as full as any other.
  const remainder = totalRows % pagination.pageSize;
  const isLastPage = pagination.pageIndex + 1 === totalPages;
  const loadingRowCount = isLastPage && remainder > 0 ? remainder : pagination.pageSize;

  return (
    <Form {...selectionForm}>
      <form className="grid max-w-full">
        <h5 className="mb-3 text-base font-medium">{displayName}</h5>

        <DataTable
          columns={columns}
          rows={tableRows ?? []}
          isLoading={isLoading}
          loadingRowCount={loadingRowCount}
          errorColumn={errorColumn}
          toolbar={
            <>
              {columns.length > 0 && (
                <div className="mb-4">
                  <FilterChipBar
                    experimentId={experimentId}
                    tableName={tableName}
                    columns={columns}
                    value={filters}
                    onChange={setFilters}
                  />
                </div>
              )}
              <BulkActionsBar
                rowIds={selectedRowIds}
                tableRows={tableRows}
                downloadTable={() => {
                  setDownloadModalOpen(true);
                }}
                onAddAnnotation={openAddAnnotationDialog}
                onDeleteAnnotations={openDeleteAnnotationsDialog}
                canContribute={canContribute}
              />
            </>
          }
          pagination={{
            mode: "server",
            state: pagination,
            onChange: handlePaginationChange,
            totalRows,
            totalPages,
          }}
          sorting={{ column: sortColumn, direction: sortDirection, onSort: handleSort }}
          selection={{ state: rowSelection, onChange: setRowSelection }}
          cellHandlers={{
            onChartClick: toggleChartPin,
            // Withheld without `can(contribute)`: the cells hide their
            // add/remove controls when the handler is absent.
            onAddAnnotation: canContribute ? openAddAnnotationDialog : undefined,
            onDeleteAnnotations: canContribute ? openDeleteAnnotationsDialog : undefined,
          }}
        />

        <DataExportModal
          experimentId={experimentId}
          tableName={tableName}
          displayName={displayName}
          open={downloadModalOpen}
          onOpenChange={setDownloadModalOpen}
        />
        {chartDisplay && (
          <div id="experiment-data-chart" className="mt-6">
            <ExperimentDataTableChart
              data={chartDisplay.data}
              columnName={chartDisplay.columnName}
              visible={true}
              isClicked={chartDisplay.isPinned}
              onClose={closePinnedChart}
            />
          </div>
        )}
      </form>
      <AddAnnotationDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={addAnnotationRowIds}
        type={addAnnotationType}
        open={addAnnotationDialogOpen}
        setOpen={setAddAnnotationDialogOpen}
        clearSelection={() => {
          setRowSelection({});
        }}
      />
      <DeleteAnnotationsDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={deleteAnnotationRowIds}
        type={deleteAnnotationType}
        open={deleteAnnotationsDialogOpen}
        setOpen={setDeleteAnnotationsDialogOpen}
        clearSelection={() => {
          setRowSelection({});
        }}
      />
    </Form>
  );
}
