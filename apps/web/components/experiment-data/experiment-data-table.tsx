"use client";

import { DataTable } from "@/components/data-table/data-table";
import type {
  OnAnnotationHandler,
  TableMetadata,
} from "@/components/data-table/data-table-columns";
import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useLandedRowIds } from "@/hooks/useLandedRowIds";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PaginationState, RowSelectionState } from "@tanstack/react-table";
import { subDays } from "date-fns";
import React, { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { AddAnnotationDialog } from "~/components/experiment-data/annotations/add-annotation-dialog";
import { BulkActionsBar } from "~/components/experiment-data/annotations/bulk-actions-bar";
import { DeleteAnnotationsDialog } from "~/components/experiment-data/annotations/delete-annotations-dialog";
import { useUrlDataFilters } from "~/hooks/useUrlDataFilters";

import type { ExperimentAnnotationType } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Form } from "@repo/ui/components/form";
import { Skeleton } from "@repo/ui/components/skeleton";

import { FilterChipBar } from "../data-filters/filter-chip-bar";
import { DataExportModal } from "./data-export-modal/data-export-modal";

function getSortColumnName(columnName: string, columnType?: string): string {
  if (columnType === "USER") {
    return "user_name";
  }
  return columnName;
}

// Past this size, reading a whole time-sorted table page by page is what makes it slow.
const DEFAULT_WINDOW_MIN_ROWS = 200_000;
const DEFAULT_WINDOW_DAYS = 30;

/**
 * A large time-sorted table opens on the 30 days up to its newest row, as an ordinary filter the
 * user can remove. Counting back from the newest row rather than today keeps a table whose
 * experiment stopped measuring from opening empty.
 */
function defaultWindowFilters(table: {
  defaultSortColumn?: string;
  tableRowCount?: number;
  latestRowAt?: string | null;
}): ExperimentDataFilter[] {
  const isLarge = (table.tableRowCount ?? 0) > DEFAULT_WINDOW_MIN_ROWS;
  const isTimeSorted = table.defaultSortColumn === "timestamp";
  if (!isLarge || !isTimeSorted || !table.latestRowAt) {
    return [];
  }

  const from = subDays(new Date(table.latestRowAt), DEFAULT_WINDOW_DAYS);
  return [{ column: "timestamp", operator: "greater_than_or_equal", value: from.toISOString() }];
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
  tableRowCount,
  latestRowAt,
  canContribute = false,
}: {
  experimentId: string;
  tableName: string;
  pageSize: number;
  displayName?: string;
  defaultSortColumn?: string;
  errorColumn?: string;
  tableRowCount?: number;
  latestRowAt?: string | null;
  /** Whether annotation controls are available. */
  canContribute?: boolean;
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [persistedMetaData, setPersistedMetaData] = useState<TableMetadata>();
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | undefined>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");

  const {
    filters,
    setFilters,
    completeFilters: activeFilters,
  } = useUrlDataFilters(
    tableName,
    defaultWindowFilters({ defaultSortColumn, tableRowCount, latestRowAt }),
  );

  const [addAnnotationDialogOpen, setAddAnnotationDialogOpen] = useState(false);
  const [addAnnotationRowIds, setAddAnnotationRowIds] = useState<string[]>([]);
  const [addAnnotationType, setAddAnnotationType] = useState<ExperimentAnnotationType>("comment");
  const [deleteAnnotationsDialogOpen, setDeleteAnnotationsDialogOpen] = useState(false);
  const [deleteAnnotationRowIds, setDeleteAnnotationRowIds] = useState<string[]>([]);
  const [deleteAnnotationType, setDeleteAnnotationType] =
    useState<ExperimentAnnotationType>("comment");

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const selectionForm = useForm<BulkSelectionFormType>({
    resolver: zodResolver(bulkSelectionFormSchema),
    defaultValues: { selectedRowIds: [] },
  });

  const { t } = useTranslation();

  const openAddAnnotationDialog = useCallback<OnAnnotationHandler>((rowIds, type = "comment") => {
    setAddAnnotationRowIds(rowIds);
    setAddAnnotationType(type);
    setAddAnnotationDialogOpen(true);
  }, []);

  const openDeleteAnnotationsDialog = useCallback<OnAnnotationHandler>(
    (rowIds, type = "comment") => {
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

  const viewKey = [
    pagination.pageIndex,
    pagination.pageSize,
    sortColumn,
    sortDirection,
    filtersKey,
  ].join("|");
  const landedRowIds = useLandedRowIds(tableRows, viewKey);

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
          landedRowIds={landedRowIds}
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
